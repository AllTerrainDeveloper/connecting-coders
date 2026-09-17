import type { Graph } from "./types";
export interface Point {
  x: number;
  y: number;
}
/** Stable, bounded layout. Route stays legible while neighboring evidence forms a halo. */
export function layoutGraph(
  graph: Graph,
  path: string[],
  vertical = false,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  const anchors = path.length
    ? path
    : graph.nodes.slice(0, 2).map((n) => n.login);
  anchors.forEach((id, i) =>
    positions.set(id, {
      x: anchors.length === 1 ? 500 : 130 + (i * 740) / (anchors.length - 1),
      y: 365 - Math.sin((i / Math.max(1, anchors.length - 1)) * Math.PI) * 65,
    }),
  );
  if (vertical) {
    anchors.forEach((id, i) =>
      positions.set(id, {
        x: 245,
        y: anchors.length === 1 ? 390 : 220 + (i * 350) / (anchors.length - 1),
      }),
    );
    const surrounding = graph.nodes.filter(
      (node) => !positions.has(node.login),
    );
    const half = Math.max(1, Math.ceil(surrounding.length / 2));
    surrounding.forEach((node, i) =>
      positions.set(node.login, {
        x: (i < half ? 65 : 525) + Math.sin(i * 2.4) * 22,
        y: 205 + ((i % half) * 380) / Math.max(1, half - 1),
      }),
    );
    return positions;
  }
  const rest = graph.nodes.filter((n) => !positions.has(n.login));
  const half = Math.ceil(rest.length / 2);
  const columns =
    rest.length <= 20
      ? Math.max(1, half)
      : Math.ceil(Math.sqrt(rest.length) * 1.65);
  rest.forEach((node, i) => {
    const band = i < half ? 0 : 1;
    const index = i % half;
    const bandCount = band === 0 ? half : rest.length - half;
    const row = Math.floor(index / columns);
    const rowCount = Math.ceil(bandCount / columns);
    const inRow = Math.min(columns, bandCount - row * columns);
    const column = index % columns;
    positions.set(node.login, {
      x: inRow === 1 ? 500 : 120 + (column * 760) / (inRow - 1),
      y:
        rowCount === 1
          ? (band === 0 ? 185 : 505) + Math.sin(column * 2.4) * 25
          : (band === 0 ? 125 : 470) + (row * 95) / (rowCount - 1),
    });
  });
  return positions;
}
