import { describe, expect, it } from "vitest";
import { shortestPath } from "../lib/graph/path";
import { searchConnections } from "../lib/graph/search";
import type { FollowEdge, GraphProvider } from "../lib/graph/types";
const edge = (source: string, target: string) => ({ source, target });
function provider(edges: FollowEdge[], hasMore = false): GraphProvider {
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    async user(login) {
      requests++;
      return { login };
    },
    async neighbors(login, direction, signal) {
      signal.throwIfAborted();
      requests++;
      return {
        hasMore,
        users: edges
          .filter((e) =>
            direction === "following" ? e.source === login : e.target === login,
          )
          .map((e) => ({
            login: direction === "following" ? e.target : e.source,
          })),
      };
    },
  };
}
const options = { maxHops: 4, maxExpansions: 20, maxNodes: 100 };
describe("directed shortest observed path", () => {
  it("does not turn a follow into a reciprocal relationship", () =>
    expect(shortestPath([edge("a", "b")], "b", "a")).toEqual([]));
  it("finds the shortest route across cycles and alternative routes", () =>
    expect(
      shortestPath(
        [
          edge("a", "b"),
          edge("b", "a"),
          edge("b", "c"),
          edge("c", "z"),
          edge("a", "d"),
          edge("d", "z"),
        ],
        "a",
        "z",
      ),
    ).toEqual(["a", "d", "z"]));
  it("enforces the hop ceiling", () =>
    expect(shortestPath([edge("a", "b"), edge("b", "c")], "a", "c", 1)).toEqual(
      [],
    ));
  it("handles zero jumps", () =>
    expect(shortestPath([], "a", "a")).toEqual(["a"]));
});
describe("bounded discovery", () => {
  it("joins forward following with reverse followers without reversing evidence", async () => {
    const result = await searchConnections(
      provider([edge("a", "b"), edge("b", "c"), edge("c", "z")]),
      "a",
      "z",
      new AbortController().signal,
      options,
    );
    expect(result.path).toEqual(["a", "b", "c", "z"]);
    expect(result.edges).toContainEqual(edge("c", "z"));
  });
  it("does not infer a path from common followers", async () => {
    const result = await searchConnections(
      provider([edge("c", "a"), edge("c", "z")]),
      "a",
      "z",
      new AbortController().signal,
      options,
    );
    expect(result.path).toEqual([]);
    expect(result.outcome).toBe("not-found");
  });
  it("reports pagination as incomplete, never an exhaustive negative", async () => {
    const result = await searchConnections(
      provider([], true),
      "a",
      "z",
      new AbortController().signal,
      options,
    );
    expect(result.outcome).toBe("limited");
  });
  it("caps nodes and expansions and preserves endpoints", async () => {
    const result = await searchConnections(
      provider([edge("a", "b"), edge("a", "c"), edge("c", "z")]),
      "a",
      "z",
      new AbortController().signal,
      { ...options, maxNodes: 2, maxExpansions: 1 },
    );
    expect(result.nodes.map((n) => n.login)).toEqual(["a", "z"]);
    expect(result.expanded).toBe(1);
    expect(result.outcome).toBe("limited");
  });
  it("cancels before further neighbor requests", async () => {
    const abort = new AbortController();
    const p = provider([edge("a", "b")]);
    await expect(
      searchConnections(p, "a", "z", abort.signal, {
        ...options,
        onProgress: () => abort.abort(),
      }),
    ).rejects.toThrow();
    expect(p.requests).toBe(3);
  });
  it("validates limits before making requests", async () => {
    const p = provider([]);
    await expect(
      searchConnections(p, "a", "z", new AbortController().signal, {
        ...options,
        maxHops: 0,
      }),
    ).rejects.toThrow("Invalid search limits");
    expect(p.requests).toBe(0);
  });
});
