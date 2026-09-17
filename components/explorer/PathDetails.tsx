import { CircleHelp, Network, Route } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { SearchResult } from "@/lib/graph/types";
interface Props {
  result: SearchResult;
  isDemo: boolean;
  busy: boolean;
  onSelect: (login: string) => void;
  className: string;
}
export default function PathDetails({
  result,
  isDemo,
  busy,
  onSelect,
  className,
}: Props) {
  const jumps = Math.max(0, result.path.length - 1);
  const state = busy
    ? "searching"
    : result.path.length
      ? result.path.join(">")
      : "empty";
  return (
    <div className={className}>
      <section className="route-panel" aria-label="Connection path">
        <div className="section-label">
          <Route size={17} />
          {isDemo
            ? "ILLUSTRATIVE PATH"
            : busy
              ? "DISCOVERING CONNECTIONS"
              : result.path.length
                ? "SHORTEST OBSERVED PATH"
                : "SEARCH COVERAGE"}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 12, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {result.path.length > 0 ? (
              <>
                <div className="path-count">
                  <motion.strong
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.12 }}
                  >
                    {jumps}
                  </motion.strong>
                  <span>
                    {jumps === 1 ? "jump" : "jumps"}
                    <br />
                    <small>{Math.max(0, jumps - 1)} people in between</small>
                  </span>
                </div>
                <ol className="path-list">
                  {result.path.map((id, i) => (
                    <motion.li
                      key={id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.55,
                        delay: i * 0.18 + 0.15,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <button
                        className="path-step"
                        onClick={() => onSelect(id)}
                      >
                        <span className="step-number">{i}</span>
                        <span>
                          <strong>
                            {result.nodes.find((n) => n.login === id)?.name ??
                              id}
                          </strong>
                          <small>@{id}</small>
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="no-path">
                <div className={busy ? "discovery-mark" : ""}>
                  <Network size={28} />
                </div>
                <strong>
                  {busy
                    ? "Building your network"
                    : result.nodes.length
                      ? "No path found in this search"
                      : "Ready to explore"}
                </strong>
                <p>
                  {busy
                    ? "Tracing public follows from both ends. Watch the network unfold."
                    : "A limited search cannot rule out a connection. Try a closer starting point or a different destination."}
                </p>
              </div>
            )}
            <p className="footnote">
              {isDemo
                ? "This sample uses fictional people and connections. Search above for real GitHub data."
                : result.path.length
                  ? result.mode === "mutual"
                    ? "Every connection in this route has a follow in both directions. Mutual follows still do not guarantee a personal relationship."
                    : "This route can use a follow in either direction. The evidence panel shows who follows whom. It is the shortest route observed so far."
                  : "Only public follow data is visible. Private profiles and unexamined connections can hide possible paths."}
            </p>
            {!isDemo && !busy && result.truncated && (
              <p className="coverage-note">
                {result.pages ?? 0} pages explored · {result.pending ?? 0} lists
                queued. Resume to continue.
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
      <div className="sidebar-note">
        <CircleHelp size={17} />
        <p>A follow is a lead, not a promise of an introduction.</p>
      </div>
    </div>
  );
}
