import type { Graph } from "./types";
export interface Position3D {
  x: number;
  y: number;
  z: number;
}
function hash(value: string) {
  let seed = 2166136261;
  for (const char of value) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return (seed >>> 0) / 4294967296;
}
/** Stable spherical coordinates: changes in graph size never reshuffle existing identities. */
export function layoutSpace(
  graph: Graph,
  path: string[],
): Map<string, Position3D> {
  const result = new Map<string, Position3D>();
  for (const node of graph.nodes) {
    const theta = hash(node.login) * Math.PI * 2;
    const phi = Math.acos(2 * hash(node.login + "phi") - 1);
    const radius = 85 + hash(node.login + "radius") * 155;
    result.set(node.login, {
      x: Math.sin(phi) * Math.cos(theta) * radius,
      y: Math.cos(phi) * radius * 0.65,
      z: Math.sin(phi) * Math.sin(theta) * radius,
    });
  }
  path.forEach((id, i) => {
    const t = path.length === 1 ? 0.5 : i / (path.length - 1);
    result.set(id, {
      x: (t - 0.5) * 280,
      y: Math.sin(t * Math.PI * 1.7) * 45,
      z: Math.cos(t * Math.PI * 2) * 65 - 30,
    });
  });
  return result;
}
