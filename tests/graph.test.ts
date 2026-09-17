import { describe, expect, it } from "vitest";
import { shortestPath } from "../lib/graph/path";
const edge = (source: string, target: string) => ({ source, target });
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

import { connectionPath } from "../lib/graph/path";
describe("connection traversal", () => {
  it("uses incoming follows without inventing reciprocal evidence", () => {
    const edges = [edge("b", "a"), edge("c", "b")];
    expect(connectionPath(edges, "a", "c", 3, "either")).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(edges).toEqual([edge("b", "a"), edge("c", "b")]);
  });
  it("requires both observed follows for every mutual hop", () => {
    const edges = [edge("a", "b"), edge("b", "a"), edge("b", "c")];
    expect(connectionPath(edges, "a", "c", 3, "mutual")).toEqual([]);
    expect(
      connectionPath([...edges, edge("c", "b")], "a", "c", 3, "mutual"),
    ).toEqual(["a", "b", "c"]);
  });
});
