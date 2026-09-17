"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, Play } from "lucide-react";
import type { Graph } from "@/lib/graph/types";
import type { GraphScene } from "@/lib/rendering/GraphScene";
interface Props {
  graph: Graph;
  path: string[];
  onSelect: (login: string) => void;
}
export default function GraphCanvas({ graph, path, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<GraphScene | null>(null);
  const latest = useRef({ graph, path, onSelect });
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    latest.current = { graph, path, onSelect };
    scene.current?.setGraph(graph, path);
  }, [graph, path, onSelect]);
  useEffect(() => {
    let disposed = false;
    void import("@/lib/rendering/GraphScene")
      .then(async ({ GraphScene }) => {
        if (disposed || !host.current) return;
        const instance = await GraphScene.create(host.current, (login) =>
          latest.current.onSelect(login),
        );
        if (disposed) {
          instance.destroy();
          return;
        }
        scene.current = instance;
        instance.setGraph(latest.current.graph, latest.current.path);
      })
      .catch(() => {
        if (!disposed) setFailure(true);
      });
    return () => {
      disposed = true;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);
  return (
    <>
      <div
        ref={host}
        className="graph-canvas"
        role="img"
        aria-label={`Directed connection map: ${graph.nodes.length} developers. The path and developer list are available as text.`}
      />
      {failure && (
        <div className="canvas-fallback">
          Your browser could not display the map. Explore the same connections
          in the path and developer list.
        </div>
      )}
      {path.length > 1 && (
        <button
          className="replay-route"
          onClick={() => scene.current?.replay()}
        >
          <Play size={14} /> Replay route
        </button>
      )}
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => scene.current?.zoom(1.2)}>
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => scene.current?.zoom(1 / 1.2)}
        >
          <Minus size={18} />
        </button>
        <span />
        <button
          aria-label="Fit network to screen"
          onClick={() => scene.current?.fit()}
        >
          <Maximize size={17} />
        </button>
      </div>
    </>
  );
}
