import type { SearchResult } from "./types";
const names = [
  "you",
  "referee",
  "maintainer",
  "target",
  "builder",
  "designer",
  "contributor",
  "reviewer",
  "researcher",
  "toolmaker",
  "developer",
  "engineer",
];
export const demo: SearchResult = {
  nodes: names.map((login, i) => ({
    login,
    name:
      ["You", "A potential referee", "A maintainer", "Your destination"][i] ??
      "Sample developer",
  })),
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 4],
    [0, 5],
    [4, 6],
    [6, 1],
    [5, 7],
    [7, 8],
    [8, 2],
    [2, 9],
    [9, 10],
    [10, 3],
    [11, 3],
    [6, 11],
  ].map(([a, b]) => ({ source: names[a], target: names[b] })),
  path: names.slice(0, 4),
  requests: 0,
  expanded: 0,
  truncated: true,
  outcome: "found",
};
