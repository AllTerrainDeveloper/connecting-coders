import type { Graph } from "./types";
import { connectionKey } from "./path";
/** Rendering has a budget; exploration does not discard evidence to satisfy it. */
export function visibleGraph(graph: Graph, path: string[], limit = 600): Graph {
  const ids = new Set(path);
  if (graph.nodes.length <= limit)
    graph.nodes.forEach((node) => ids.add(node.login));
  else {
    for (const node of graph.nodes.slice(0, 100))
      if (ids.size < limit) ids.add(node.login);
    for (let i = graph.nodes.length - 1; i >= 0 && ids.size < limit; i--)
      ids.add(graph.nodes[i].login);
  }
  const routeKeys = new Set(
    path.slice(1).map((id, i) => connectionKey(path[i], id)),
  );
  const eligible = graph.edges.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  const edges = eligible.filter((edge) =>
    routeKeys.has(connectionKey(edge.source, edge.target)),
  );
  for (const edge of eligible) {
    if (edges.length >= 5000) break;
    if (!routeKeys.has(connectionKey(edge.source, edge.target)))
      edges.push(edge);
  }
  return { nodes: graph.nodes.filter((node) => ids.has(node.login)), edges };
}
