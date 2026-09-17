"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpDown,
  GitFork,
  CodeXml,
  Network,
  ExternalLink,
  X,
  LoaderCircle,
  Users,
} from "lucide-react";
import GraphCanvas from "./GraphCanvas";
import PathDetails from "./PathDetails";
import { useConnectionSearch } from "./useConnectionSearch";
export default function Explorer() {
  const [source, setSource] = useState("yyx990803");
  const [target, setTarget] = useState("torvalds");
  const [maxHops, setMaxHops] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const { result, isDemo, busy, error, search, cancel, showDemo } =
    useConnectionSearch();
  const graph = useMemo(
    () => ({ nodes: result.nodes, edges: result.edges }),
    [result.nodes, result.edges],
  );
  const person = result.nodes.find((n) => n.login === selected);
  const jumps = Math.max(0, result.path.length - 1);
  const title = isDemo
    ? "A few hellos away."
    : busy
      ? "Following the connections…"
      : result.path.length
        ? `${jumps} ${jumps === 1 ? "jump" : "jumps"}. A possible way in.`
        : "Every connection is a starting point.";
  return (
    <MotionConfig reducedMotion="user">
      <main className="workspace">
        <header className="topbar">
          <Link className="brand" href="/">
            <GitFork size={24} />
            <span>
              connecting<span className="brand-light">coders</span>
            </span>
          </Link>
          <span className="top-label">
            A smaller world, one connection at a time.
          </span>
          <a
            href="https://docs.github.com/en/rest/users/followers"
            target="_blank"
            rel="noreferrer"
          >
            <CodeXml size={19} /> Public GitHub graph <ExternalLink size={13} />
          </a>
        </header>
        <div className="workspace-body">
          <aside className="sidebar">
            <div className="eyebrow">THE HUMAN SIDE OF OPEN SOURCE</div>
            <h1>
              Who connects <br />
              you to <em>them?</em>
            </h1>
            <p className="intro">
              Find the people between you and the developer you want to reach.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSelected(null);
                void search(source, target, maxHops);
              }}
            >
              <label htmlFor="source">Your starting point</label>
              <div className="input-shell">
                <span>@</span>
                <input
                  id="source"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={40}
                  value={source}
                  disabled={busy}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="between-inputs">
                <div className="connector-line" />
                <button
                  type="button"
                  className="swap"
                  aria-label="Swap starting point and destination"
                  disabled={busy}
                  onClick={() => {
                    setSource(target);
                    setTarget(source);
                  }}
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>
              <label htmlFor="target">Who do you want to reach?</label>
              <div className="input-shell">
                <span>@</span>
                <input
                  id="target"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={40}
                  value={target}
                  disabled={busy}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
              <div className="search-options">
                <label htmlFor="depth">Look up to</label>
                <select
                  id="depth"
                  value={maxHops}
                  disabled={busy}
                  onChange={(e) => setMaxHops(Number(e.target.value))}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} jumps
                    </option>
                  ))}
                </select>
              </div>
              {busy ? (
                <button className="primary" type="button" onClick={cancel}>
                  <LoaderCircle size={17} className="spin" /> Stop search
                </button>
              ) : (
                <button className="primary" type="submit">
                  Find a connection <ArrowRight size={18} />
                </button>
              )}
            </form>
            <div className="search-meta">
              <span>
                {busy
                  ? `${result.expanded} accounts explored`
                  : "Up to 24 requests per search"}
              </span>
              <button
                type="button"
                onClick={() => {
                  showDemo();
                  setSelected(null);
                }}
              >
                See example
              </button>
            </div>
            <div aria-live="polite" aria-atomic="true">
              {error && (
                <p className="notice" role="alert">
                  {error}
                </p>
              )}
              {!isDemo && busy && (
                <p className="footnote">
                  Exploring both ends of the path. You can stop at any time.
                </p>
              )}
            </div>
            <PathDetails
              className="desktop-path"
              result={result}
              isDemo={isDemo}
              busy={busy}
              onSelect={setSelected}
            />
          </aside>
          <section className="map-panel" aria-label="Network explorer">
            <div className="map-heading">
              <div>
                <span className="eyebrow">CONNECTION EXPLORER</span>
                <div className="title-slot">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h2
                      key={title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {title}
                    </motion.h2>
                  </AnimatePresence>
                </div>
              </div>
              <span className="pill">
                <Network size={14} />
                {isDemo
                  ? "Example network"
                  : busy
                    ? "Exploring GitHub"
                    : "Public follow data"}
              </span>
            </div>
            <GraphCanvas
              graph={graph}
              path={result.path}
              onSelect={setSelected}
            />
            <div className="map-summary">
              <span>{result.nodes.length} developers</span>
              <span>{result.edges.length} connections</span>
              {!isDemo && (
                <span>
                  {result.requests} requests
                  {result.remaining !== undefined
                    ? ` · ${result.remaining} remaining`
                    : ""}
                </span>
              )}
            </div>
            <button
              className="people-toggle"
              onClick={() => setShowPeople(!showPeople)}
              aria-expanded={showPeople}
            >
              <Users size={16} /> Developers <span>{result.nodes.length}</span>
            </button>
            <AnimatePresence>
              {showPeople && (
                <motion.div
                  className="people-panel"
                  key="people"
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="panel-title">
                    <strong>Discovered developers</strong>
                    <button
                      aria-label="Close developer list"
                      onClick={() => setShowPeople(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <ul>
                    {result.nodes.map((n) => (
                      <li key={n.login}>
                        <button
                          onClick={() => {
                            setSelected(n.login);
                            setShowPeople(false);
                          }}
                        >
                          @{n.login}
                          <ArrowRight size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {person && (
                <motion.div
                  className="person-card"
                  key={person.login}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="panel-title">
                    <span className="eyebrow">
                      {isDemo ? "SAMPLE DEVELOPER" : "PUBLIC PROFILE"}
                    </span>
                    <button
                      aria-label="Close developer details"
                      onClick={() => setSelected(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <h3>{person.name ?? person.login}</h3>
                  <span className="handle">@{person.login}</span>
                  <div className="evidence">
                    <strong>Observed connections</strong>
                    {result.edges
                      .filter(
                        (e) =>
                          e.source === person.login ||
                          e.target === person.login,
                      )
                      .slice(0, 5)
                      .map((e) => (
                        <p key={`${e.source}>${e.target}`}>
                          @{e.source} <ArrowRight size={13} /> @{e.target}
                        </p>
                      ))}
                  </div>
                  {!isDemo && (
                    <a
                      className="profile-link"
                      href={`https://github.com/${encodeURIComponent(person.login)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View GitHub profile <ExternalLink size={14} />
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="map-footer">
              <span>
                <i /> Connection path <i className="muted-line" /> Public follow
              </span>
              <span>Drag to explore · Scroll to zoom</span>
            </div>
          </section>
          <PathDetails
            className="mobile-path"
            result={result}
            isDemo={isDemo}
            busy={busy}
            onSelect={setSelected}
          />
        </div>
      </main>
    </MotionConfig>
  );
}
