import type { SearchResult } from "./types";

/** Derive the report from observed evidence, never from spatial proximity. */
export function connectionReport(result: SearchResult) {
  if (!result.path.length) return null;
  const people = new Map(result.nodes.map((person) => [person.login, person]));
  const observed = new Set(
    result.edges.map((edge) => `${edge.source}>${edge.target}`),
  );
  const steps = result.path.map((login, index) => {
    const next = result.path[index + 1];
    const evidence = next
      ? [
          ...(observed.has(`${login}>${next}`)
            ? [{ source: login, target: next }]
            : []),
          ...(observed.has(`${next}>${login}`)
            ? [{ source: next, target: login }]
            : []),
        ]
      : [];
    return { login, name: people.get(login)?.name ?? login, evidence };
  });
  return {
    source: result.path[0],
    target: result.path.at(-1)!,
    hops: result.path.length - 1,
    intermediaries: Math.max(0, result.path.length - 2),
    steps,
  };
}

export function reportText(result: SearchResult, isDemo: boolean) {
  const report = connectionReport(result);
  if (!report) return "";
  return [
    isDemo
      ? "CONNECTING CODERS · ILLUSTRATIVE REPORT"
      : "CONNECTING CODERS · CONNECTION REPORT",
    `@${report.source} → @${report.target}`,
    `${report.hops} hops · ${report.intermediaries} people in between`,
    "",
    "Route: " + report.steps.map((step) => `@${step.login}`).join(" → "),
    "",
    "Observed follow evidence:",
    ...report.steps.flatMap((step) =>
      step.evidence.map((edge) => `@${edge.source} follows @${edge.target}`),
    ),
    "",
    `${result.nodes.length} developers · ${result.edges.length} follows · ${result.pages ?? 0} pages explored`,
    isDemo
      ? "Fictional sample; not real GitHub evidence."
      : "Shortest route observed so far. Public follows suggest possible introductions, not verified relationships.",
    result.truncated
      ? "Exploration is incomplete; a shorter route may still exist."
      : "The selected exploration has completed; this is not a global GitHub shortest-path guarantee.",
  ].join("\n");
}
