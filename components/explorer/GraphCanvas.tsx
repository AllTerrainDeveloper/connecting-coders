"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, Play } from "lucide-react";
import type { Graph } from "@/lib/graph/types";
import type { SpaceScene } from "@/lib/rendering/SpaceScene";
interface Props {
  graph: Graph;
  path: string[];
  onSelect: (login: string) => void;
}
export default function GraphCanvas({ graph, path, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SpaceScene | null>(null);
  const latest = useRef({ graph, path, onSelect });
  const [failure, setFailure] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    latest.current = { graph, path, onSelect };
    scene.current?.setGraph(graph, path);
  }, [graph, path, onSelect]);
  useEffect(() => {
    let disposed = false;
    void import("@/lib/rendering/SpaceScene")
      .then(async ({ SpaceScene }) => {
        if (disposed || !host.current) return;
        const instance = await SpaceScene.create(host.current, (login) =>
          latest.current.onSelect(login),
        );
        if (disposed) {
          instance.destroy();
          return;
        }
        scene.current = instance;
        instance.setGraph(latest.current.graph, latest.current.path);
        setReady(true);
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
        aria-label={`Three-dimensional connection space: ${graph.nodes.length} developers. The path and developer list are available as text.`}
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
          disabled={!ready}
          onClick={() => scene.current?.replay()}
        >
          <Play size={14} /> Fly through route
        </button>
      )}
      <div className="map-controls">
        <button
          disabled={!ready}
          aria-label="Zoom in"
          onClick={() => scene.current?.zoom(1.2)}
        >
          <Plus size={18} />
        </button>
        <button
          disabled={!ready}
          aria-label="Zoom out"
          onClick={() => scene.current?.zoom(1 / 1.2)}
        >
          <Minus size={18} />
        </button>
        <span />
        <button
          disabled={!ready}
          aria-label="Return to overview"
          onClick={() => scene.current?.fit()}
        >
          <Maximize size={17} />
        </button>
      </div>
    </>
  );
}
