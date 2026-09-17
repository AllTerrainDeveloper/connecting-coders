import { describe, expect, it } from "vitest";
import { connectionReport, reportText } from "../lib/graph/report";
import type { SearchResult } from "../lib/graph/types";
const result: SearchResult = {
  nodes: [
    { login: "alice", name: "Alice" },
    { login: "bob" },
    { login: "carol" },
  ],
  edges: [
    { source: "bob", target: "alice" },
    { source: "bob", target: "carol" },
    { source: "carol", target: "bob" },
  ],
  path: ["alice", "bob", "carol"],
  mode: "either",
  requests: 3,
  expanded: 2,
  truncated: true,
  outcome: "found",
};
describe("connection reports", () => {
  it("preserves reverse follows and distinguishes mutual evidence", () => {
    const report = connectionReport(result)!;
    expect(report.hops).toBe(2);
    expect(report.intermediaries).toBe(1);
    expect(report.steps[0].evidence).toEqual([
      { source: "bob", target: "alice" },
    ]);
    expect(report.steps[1].evidence).toHaveLength(2);
    expect(report.steps[2].evidence).toEqual([]);
    expect(reportText(result, false)).toContain("@bob follows @alice");
    expect(reportText(result, false)).not.toContain("@alice follows @bob");
  });
  it("has no report before a route exists and handles the zero-hop case", () => {
    expect(connectionReport({ ...result, path: [] })).toBeNull();
    expect(reportText({ ...result, path: [] }, false)).toBe("");
    expect(connectionReport({ ...result, path: ["alice"] })).toMatchObject({
      hops: 0,
      intermediaries: 0,
      source: "alice",
      target: "alice",
    });
  });
  it("does not invent missing evidence and labels incomplete and fictional results", () => {
    expect(
      connectionReport({ ...result, edges: [] })!.steps[0].evidence,
    ).toEqual([]);
    expect(reportText(result, false)).toContain(
      "a shorter route may still exist",
    );
    expect(reportText(result, true)).toContain("Fictional sample");
    expect(reportText({ ...result, truncated: false }, false)).toContain(
      "not a global GitHub shortest-path guarantee",
    );
  });
});
