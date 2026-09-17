"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Terminal, Radio } from "lucide-react";
import { demo } from "@/lib/graph/demo";
import type { DiscoveryBatch } from "@/lib/graph/exploration";
import type { ExplorationPhase } from "./useConnectionSearch";
interface Props {
  batch: DiscoveryBatch | null;
  phase: ExplorationPhase;
  isDemo: boolean;
}
export default function DiscoveryConsole({ batch, phase, isDemo }: Props) {
  const reduced = useReducedMotion();
  const users = isDemo ? demo.nodes : (batch?.users ?? []);
  const key = isDemo ? "simulation" : (batch?.sequence ?? "waiting");
  const active = phase === "revealing" || isDemo;
  return (
    <>
      <div className="data-atmosphere" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((column) => (
          <div
            className="data-stream"
            key={column}
            style={{
              left: `${8 + column * 17}%`,
              animationDelay: `${column * -0.8}s`,
            }}
          >
            {users.slice(column, column + 9).map((user, i) => (
              <span key={`${user.login}-${i}`}>
                {user.login.split("").join(" ")}
              </span>
            ))}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.aside
          className="discovery-console"
          key={key}
          aria-label="Discovery batch"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5 }}
        >
          <div className="console-head">
            <span>
              <Terminal size={13} />{" "}
              {isDemo
                ? "SIMULATION"
                : `BATCH ${String(batch?.sequence ?? 0).padStart(3, "0")}`}
            </span>
            <Radio size={14} className={active ? "signal-pulse" : ""} />
          </div>
          <div className="console-source">
            {isDemo
              ? "FICTIONAL SIGNALS / DEMO"
              : batch
                ? `@${batch.login} / ${batch.direction} / P${batch.page}`
                : "AWAITING YOUR COORDINATES"}
          </div>
          <div className="name-reel" aria-hidden="true">
            <motion.div
              initial={{ y: 0 }}
              animate={{
                y:
                  active && !reduced
                    ? -Math.max(0, users.length * 27 - 108)
                    : 0,
              }}
              transition={{ duration: 4.8, ease: "linear", delay: 0.15 }}
            >
              {users.length ? (
                users.map((user, i) => (
                  <div className="signal-name" key={`${user.login}-${i}`}>
                    <span>{String(i + 1).padStart(3, "0")}</span>
                    <strong>@{user.login}</strong>
                    <span>FOUND</span>
                  </div>
                ))
              ) : (
                <div className="console-idle">
                  ENTER TWO HANDLES TO BEGIN
                  <span className="cursor-blink">_</span>
                </div>
              )}
            </motion.div>
          </div>
          <div className="console-foot">
            <span>
              {users.length} {isDemo ? "sample names" : "public accounts"}
            </span>
            <span>
              {phase === "paused" ? "PAUSED" : active ? "DECODING" : "READY"}
            </span>
          </div>
          {active && (
            <motion.div
              className="decode-progress"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 5, ease: "linear" }}
            />
          )}
        </motion.aside>
      </AnimatePresence>
      <AnimatePresence>
        {phase === "revealing" && (
          <motion.div
            key={batch?.sequence}
            className="scan-sweep"
            initial={{ top: "18%", opacity: 0 }}
            animate={{ top: "88%", opacity: [0, 0.5, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 5, ease: "linear" }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
