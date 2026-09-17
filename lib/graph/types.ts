/** Directed public evidence: source follows target. Never implies a friendship. */
export interface Coder {
  login: string;
  name?: string;
  avatarUrl?: string;
}
export interface FollowEdge {
  source: string;
  target: string;
}
export interface Graph {
  nodes: Coder[];
  edges: FollowEdge[];
}
export interface SearchProgress extends Graph {
  requests: number;
  expanded: number;
  truncated: boolean;
  remaining?: number;
}
export interface SearchResult extends SearchProgress {
  path: string[];
  outcome: "found" | "limited" | "not-found";
}
export interface Neighbors {
  users: Coder[];
  hasMore: boolean;
}
export interface GraphProvider {
  user(login: string, signal: AbortSignal): Promise<Coder>;
  neighbors(
    login: string,
    direction: "following" | "followers",
    signal: AbortSignal,
  ): Promise<Neighbors>;
  readonly requests: number;
  readonly remaining?: number;
}
