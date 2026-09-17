import type {
  Coder,
  FollowEdge,
  GraphProvider,
  SearchProgress,
  SearchResult,
} from "./types";
import { shortestPath } from "./path";
export interface SearchOptions {
  maxHops: number;
  maxExpansions: number;
  maxNodes: number;
  onProgress?: (progress: SearchProgress) => void;
}
/** Bounded two-ended discovery: following from source, followers from destination.
 * We never invert evidence. Completeness is explicit because high-degree lists are sampled.
 */
export async function searchConnections(
  provider: GraphProvider,
  source: string,
  target: string,
  signal: AbortSignal,
  options: SearchOptions,
): Promise<SearchResult> {
  const { maxHops, maxExpansions, maxNodes, onProgress } = options;
  if (
    !Number.isInteger(maxHops) ||
    maxHops < 1 ||
    maxHops > 6 ||
    !Number.isInteger(maxExpansions) ||
    maxExpansions < 1 ||
    !Number.isInteger(maxNodes) ||
    maxNodes < 2
  )
    throw new Error("Invalid search limits");
  const nodes = new Map<string, Coder>();
  const edges = new Map<string, FollowEdge>();
  const start = await provider.user(source, signal);
  nodes.set(start.login, start);
  const end = source === target ? start : await provider.user(target, signal);
  nodes.set(end.login, end);
  source = start.login;
  target = end.login;
  let expanded = 0,
    truncated = false;
  const snapshot = (): SearchProgress => ({
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    requests: provider.requests,
    remaining: provider.remaining,
    expanded,
    truncated,
  });
  const finish = (path: string[]): SearchResult => ({
    ...snapshot(),
    path,
    outcome: path.length ? "found" : truncated ? "limited" : "not-found",
  });
  if (source === target) return finish([source]);
  const queues: [string, number][][] = [[[source, 0]], [[target, 0]]];
  const seen = [new Set([source]), new Set([target])];
  let side = 0;
  while (queues[0].length || queues[1].length) {
    signal.throwIfAborted();
    if (expanded >= maxExpansions) {
      truncated = true;
      break;
    }
    if (!queues[side].length) side = 1 - side;
    const [login, depth] = queues[side].shift()!;
    if (depth >= maxHops) {
      side = 1 - side;
      continue;
    }
    const neighbors = await provider.neighbors(
      login,
      side === 0 ? "following" : "followers",
      signal,
    );
    signal.throwIfAborted();
    expanded++;
    truncated ||= neighbors.hasMore;
    for (const user of neighbors.users) {
      if (!nodes.has(user.login) && nodes.size >= maxNodes) {
        truncated = true;
        continue;
      }
      if (!nodes.has(user.login)) nodes.set(user.login, user);
      const edge =
        side === 0
          ? { source: login, target: user.login }
          : { source: user.login, target: login };
      edges.set(`${edge.source}>${edge.target}`, edge);
      if (!seen[side].has(user.login)) {
        seen[side].add(user.login);
        queues[side].push([user.login, depth + 1]);
      }
    }
    onProgress?.(snapshot());
    const path = shortestPath([...edges.values()], source, target, maxHops);
    if (path.length) return finish(path);
    side = 1 - side;
  }
  return finish([]);
}
