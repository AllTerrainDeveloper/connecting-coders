import type { FollowEdge } from "./types";
/** O(V + E), directed breadth-first search, shortest only within observed evidence. */
export function shortestPath(
  edges: FollowEdge[],
  source: string,
  target: string,
  maxHops = 6,
): string[] {
  if (source === target) return [source];
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  const parent = new Map<string, string | null>([[source, null]]);
  const queue: [string, number][] = [[source, 0]];
  for (let head = 0; head < queue.length; head++) {
    const [current, depth] = queue[head];
    if (depth >= maxHops) continue;
    for (const next of adjacency.get(current) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, current);
      if (next === target) {
        const path = [target];
        let cursor = current;
        while (cursor !== source) {
          path.push(cursor);
          cursor = parent.get(cursor)!;
        }
        return [source, ...path.reverse()];
      }
      queue.push([next, depth + 1]);
    }
  }
  return [];
}
