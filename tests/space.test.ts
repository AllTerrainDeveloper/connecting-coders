import { describe, expect, it } from "vitest";
import { layoutSpace } from "../lib/graph/layout3d";
import { visibleGraph } from "../lib/graph/visible";
const graph = {
  nodes: Array.from({ length: 1000 }, (_, i) => ({ login: `coder-${i}` })),
  edges: [{ source: "coder-499", target: "coder-500" }],
};
describe("stable spatial evidence", () => {
  it("uses genuine depth and finite three-dimensional coordinates", () => {
    const positions = [...layoutSpace(graph, []).values()];
    expect(
      positions.every(
        (p) =>
          Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
      ),
    ).toBe(true);
    expect(
      Math.max(...positions.map((p) => p.z)) -
        Math.min(...positions.map((p) => p.z)),
    ).toBeGreaterThan(100);
  });
  it("does not reshuffle an identity when unrelated nodes arrive", () => {
    const small = { nodes: graph.nodes.slice(0, 10), edges: [] };
    expect(layoutSpace(small, []).get("coder-3")).toEqual(
      layoutSpace(graph, []).get("coder-3"),
    );
  });
  it("bounds only the view and preserves route nodes and evidence", () => {
    const path = ["coder-499", "coder-500"];
    const view = visibleGraph(graph, path);
    expect(view.nodes).toHaveLength(600);
    expect(view.nodes.map((n) => n.login)).toEqual(
      expect.arrayContaining(path),
    );
    expect(view.edges).toContainEqual(graph.edges[0]);
    expect(graph.nodes).toHaveLength(1000);
  });
});
