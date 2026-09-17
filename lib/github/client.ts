import { z } from "zod";
import type { Coder, GraphProvider, Neighbors } from "../graph/types";
const userSchema = z.object({
  login: z.string().min(1),
  type: z.string(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().url().optional(),
});
const cache = new Map<
  string,
  { expires: number; value: unknown; hasMore: boolean }
>();
const TTL = 5 * 60_000;
let blockedUntil = 0;
export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly kind:
      "rate-limit" | "not-found" | "network" | "invalid" | "budget" | "auth",
  ) {
    super(message);
    this.name = "GitHubError";
  }
}
export function normalizeLogin(value: string): string {
  const login = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(login))
    throw new GitHubError(
      "Enter a valid GitHub username (up to 39 letters, numbers or single hyphens).",
      "invalid",
    );
  return login;
}
function coder(value: z.infer<typeof userSchema>): Coder {
  return {
    login: value.login.toLowerCase(),
    name: value.name ?? undefined,
    avatarUrl: value.avatar_url,
  };
}
/** Public read-only adapter. A session-wide cooldown protects subsequent searches too. */
export class GitHubClient implements GraphProvider {
  requests = 0;
  remaining?: number;
  constructor(
    private readonly maxRequests = 24,
    private readonly transport: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}
  private async get(
    path: string,
    signal: AbortSignal,
  ): Promise<{ value: unknown; hasMore: boolean }> {
    signal.throwIfAborted();
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) return cached;
    if (Date.now() < blockedUntil)
      throw new GitHubError(
        `GitHub asks us to wait. Try again after ${new Date(blockedUntil).toLocaleTimeString()}.`,
        "rate-limit",
      );
    if (this.requests >= this.maxRequests)
      throw new GitHubError(
        "This search reached its request budget.",
        "budget",
      );
    this.requests++;
    let response: Response;
    try {
      response = await this.transport(`/api/github${path}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
        headers: { Accept: "application/vnd.github+json" },
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new GitHubError(
        "GitHub could not be reached. Check your connection and try again.",
        "network",
      );
    }
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining !== null) this.remaining = Number(remaining);
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    if (this.remaining === 0)
      blockedUntil = Math.max(Date.now() + 60_000, reset || 0);
    if (response.status === 429 || response.status === 403) {
      const retry = Number(response.headers.get("retry-after")) * 1000;
      blockedUntil = Math.max(blockedUntil, Date.now() + (retry || 60_000));
      throw new GitHubError(
        `GitHub has paused requests. Try after ${new Date(blockedUntil).toLocaleTimeString()}.`,
        "rate-limit",
      );
    }
    if (response.status === 401)
      throw new GitHubError("GitHub access needs reconnecting. Check your server sign-in and reload the app.", "auth");
    if (response.status === 404)
      throw new GitHubError(
        "That GitHub user could not be found. Check the username.",
        "not-found",
      );
    if (!response.ok)
      throw new GitHubError(
        `GitHub returned an error (${response.status}). Try again later.`,
        "network",
      );
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new GitHubError(
        "GitHub returned an unreadable response.",
        "invalid",
      );
    }
    return {
      value,
      hasMore: /rel="next"/.test(response.headers.get("link") ?? ""),
    };
  }
  private remember(path: string, result: { value: unknown; hasMore: boolean }) {
    // A cache hit must not extend the original freshness window.
    if (cache.get(path)?.value === result.value) return;
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(path, { ...result, expires: Date.now() + TTL });
  }
  async user(login: string, signal: AbortSignal): Promise<Coder> {
    const path = `/users/${normalizeLogin(login)}`;
    const result = await this.get(path, signal);
    const parsed = userSchema.safeParse(result.value);
    if (!parsed.success || parsed.data.type !== "User")
      throw new GitHubError(
        "Choose a personal GitHub account, rather than an organization.",
        "invalid",
      );
    this.remember(path, result);
    return coder(parsed.data);
  }
  async neighbors(
    login: string,
    direction: "following" | "followers",
    signal: AbortSignal,
    page = 1,
  ): Promise<Neighbors> {
    if (!Number.isInteger(page) || page < 1)
      throw new GitHubError("Invalid page number.", "invalid");
    const path = `/users/${normalizeLogin(login)}/${direction}?per_page=100&page=${page}`;
    const result = await this.get(path, signal);
    const parsed = z.array(userSchema).safeParse(result.value);
    if (!parsed.success)
      throw new GitHubError(
        "GitHub returned unexpected connection data.",
        "invalid",
      );
    this.remember(path, result);
    return {
      users: parsed.data.filter((u) => u.type === "User").map(coder),
      hasMore: result.hasMore,
    };
  }
}
