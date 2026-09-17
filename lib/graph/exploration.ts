import type {
  Coder,
  FollowEdge,
  GraphProvider,
  SearchResult,
  ConnectionMode,
} from "./types";
import { connectionPath } from "./path";
export interface DiscoveryBatch {
  sequence: number;
  login: string;
  direction: "following" | "followers";
  page: number;
  users: Coder[];
  hasMore: boolean;
}
interface Cursor {
  login: string;
  depth: number;
  page: number;
  direction: "following" | "followers";
}
/** One durable-in-memory cursor per public list. A failed request never advances it.
 * This service performs one page at a time; presentation controls pacing, not completeness. */
export class Exploration {
  private readonly nodes = new Map<string, Coder>();
  private readonly edges = new Map<string, FollowEdge>();
  private queues: Cursor[][] = [[], []];
  private seen = [new Set<string>(), new Set<string>()];
  private initialized = false;
  private side = 0;
  private pages = 0;
  private completedLists = 0;
  constructor(
    private source: string,
    private target: string,
    private readonly maxHops: number,
    private readonly mode: ConnectionMode = "either",
  ) {
    if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 6)
      throw new Error("Choose between 1 and 6 hops.");
  }
  private cursors(login: string, depth: number, side: number): Cursor[] {
    const first = side === 0 ? "following" : "followers";
    const directions: ("following" | "followers")[] =
      this.mode === "following"
        ? [first]
        : [first, first === "following" ? "followers" : "following"];
    return directions.map((direction) => ({
      login,
      depth,
      page: 1,
      direction,
    }));
  }
  get complete() {
    return this.initialized && !this.queues[0].length && !this.queues[1].length;
  }
  async initialize(provider: GraphProvider, signal: AbortSignal) {
    if (this.initialized) return;
    const source =
      this.nodes.get(this.source) ?? (await provider.user(this.source, signal));
    this.source = source.login;
    this.nodes.set(source.login, source);
    const target =
      this.nodes.get(this.target) ?? (await provider.user(this.target, signal));
    this.target = target.login;
    this.nodes.set(target.login, target);
    signal.throwIfAborted();
    this.queues = [
      this.cursors(this.source, 0, 0),
      this.cursors(this.target, 0, 1),
    ];
    this.seen = [new Set([this.source]), new Set([this.target])];
    this.initialized = true;
  }
  async next(
    provider: GraphProvider,
    signal: AbortSignal,
  ): Promise<DiscoveryBatch | null> {
    signal.throwIfAborted();
    await this.initialize(provider, signal);
    if (this.complete) return null;
    if (!this.queues[this.side].length) this.side = 1 - this.side;
    const side = this.side;
    const cursor = this.queues[side][0];
    const direction = cursor.direction;
    const result = await provider.neighbors(
      cursor.login,
      direction,
      signal,
      cursor.page,
    );
    signal.throwIfAborted();
    // Commit evidence and advance the cursor only after the full page succeeds.
    this.queues[side].shift();
    this.pages++;
    for (const coder of result.users) {
      if (!this.nodes.has(coder.login)) this.nodes.set(coder.login, coder);
      const edge =
        direction === "following"
          ? { source: cursor.login, target: coder.login }
          : { source: coder.login, target: cursor.login };
      this.edges.set(`${edge.source}>${edge.target}`, edge);
      if (
        cursor.depth + 1 < this.maxHops &&
        !this.seen[side].has(coder.login)
      ) {
        this.seen[side].add(coder.login);
        this.queues[side].push(
          ...this.cursors(coder.login, cursor.depth + 1, side),
        );
      }
    }
    if (result.hasMore)
      this.queues[side].unshift({ ...cursor, page: cursor.page + 1 });
    else this.completedLists++;
    this.side = 1 - side;
    return {
      sequence: this.pages,
      login: cursor.login,
      direction,
      page: cursor.page,
      users: result.users,
      hasMore: result.hasMore,
    };
  }
  snapshot(requests = 0, remaining?: number): SearchResult {
    const edges = [...this.edges.values()];
    const path = connectionPath(
      edges,
      this.source,
      this.target,
      this.maxHops,
      this.mode,
    );
    return {
      mode: this.mode,
      nodes: [...this.nodes.values()],
      edges,
      path,
      requests,
      remaining,
      expanded: this.completedLists,
      pages: this.pages,
      pending: this.queues[0].length + this.queues[1].length,
      truncated: !this.complete,
      outcome: path.length ? "found" : this.complete ? "not-found" : "limited",
    };
  }
}
/** Abortable pacing, with no dangling timeout or listener after pause/unmount. */
export function waitForBatch(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
