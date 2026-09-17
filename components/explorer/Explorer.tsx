"use client";
import { useMemo, useRef, useState } from "react";
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
import GitHubStatus from "./GitHubStatus";
import GraphCanvas from "./GraphCanvas";
import PathDetails from "./PathDetails";
import DiscoveryConsole from "./DiscoveryConsole";
import { visibleGraph } from "@/lib/graph/visible";
import { useConnectionSearch } from "./useConnectionSearch";
export default function Explorer() {
  const mapSection = useRef<HTMLElement>(null);
  const [githubConnected, setGitHubConnected] = useState(false);
  const [source, setSource] = useState("yyx990803");
  const [target, setTarget] = useState("torvalds");
  const [maxHops, setMaxHops] = useState(4);
  const [mode, setMode] = useState<"either" | "mutual">("either");
  const [resumeDirty, setResumeDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [peoplePage, setPeoplePage] = useState(0);
  const {
    result,
    isDemo,
    busy,
    error,
    phase,
    batch,
    search,
    cancel,
    resume,
    canResume,
    showDemo,
  } = useConnectionSearch();
  const graph = useMemo(() => visibleGraph(result, result.path), [result]);
  const person = result.nodes.find((n) => n.login === selected);
  const jumps = Math.max(0, result.path.length - 1);
  const title = isDemo
    ? "Follow the signal."
    : busy
      ? "Tracing the network."
      : result.path.length
        ? `Signal acquired. ${jumps} ${jumps === 1 ? "hop" : "hops"}.`
        : "The trace is waiting.";
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
          <span className="top-label">EVERY CONNECTION LEAVES A TRACE</span>
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
            <div className="eyebrow">HUMAN CONNECTIONS / PUBLIC SIGNALS</div>
            <h1>
              Find your <br />
              way <em>in.</em>
            </h1>
            <p className="intro">
              Trace the people between you and the developer you want to reach.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!githubConnected) return;
                setSelected(null);
                setResumeDirty(false);
                void search(source, target, maxHops, mode);
                if (window.innerWidth <= 700)
                  requestAnimationFrame(() =>
                    mapSection.current?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "auto"
                        : "smooth",
                      block: "start",
                    }),
                  );
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
                  onChange={(e) => {
                    setSource(e.target.value);
                    setResumeDirty(true);
                  }}
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
                    setResumeDirty(true);
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
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setResumeDirty(true);
                  }}
                />
              </div>
              <div className="connection-options">
                <label htmlFor="connection-mode">Connection type</label>
                <select
                  id="connection-mode"
                  value={mode}
                  disabled={busy}
                  onChange={(e) => {
                    setMode(e.target.value as "either" | "mutual");
                    setResumeDirty(true);
                  }}
                >
                  <option value="either">Either direction</option>
                  <option value="mutual">Mutual follows only</option>
                </select>
              </div>
              <div className="search-options">
                <label htmlFor="depth">Look up to</label>
                <select
                  id="depth"
                  value={maxHops}
                  disabled={busy}
                  onChange={(e) => {
                    setMaxHops(Number(e.target.value));
                    setResumeDirty(true);
                  }}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} jumps
                    </option>
                  ))}
                </select>
              </div>
              {busy ? (
                <button key="pause" className="primary" type="button" onClick={(event) => {
                  event.preventDefault();
                  cancel();
                }}>
                  <LoaderCircle size={17} className="spin" /> Pause exploration
                </button>
              ) : (
                <button key="start" className="primary" type="submit" disabled={!githubConnected}>
                  {githubConnected ? "Initiate trace" : "Connect GitHub to trace"} <ArrowRight size={18} />
                </button>
              )}
              {canResume && !resumeDirty && githubConnected && (
                <button
                  type="button"
                  className="resume-button"
                  onClick={resume}
                >
                  Resume exploration <ArrowRight size={16} />
                </button>
              )}
            </form>
            <GitHubStatus remaining={isDemo ? undefined : result.remaining} searchError={error} onConnected={setGitHubConnected} />
            <div className="search-meta">
              <span>
                {busy
                  ? `${result.pages ?? 0} pages decoded`
                  : "All pages · 5 seconds per batch"}
              </span>
              <button
                type="button"
                onClick={() => {
                  showDemo();
                  setPeoplePage(0);
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
                  Exploring every page within your hop limit. Pause whenever you
                  want.
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
          <section
            ref={mapSection}
            className="map-panel"
            aria-label="Network explorer"
          >
            <div className="map-heading">
              <div>
                <span className="eyebrow">3D SIGNAL SPACE / LIVE TOPOLOGY</span>
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
                {isDemo ? "SIMULATION" : busy ? "SCANNING" : "PUBLIC SIGNALS"}
              </span>
            </div>
            <DiscoveryConsole batch={batch} phase={phase} isDemo={isDemo} />
            <GraphCanvas
              graph={graph}
              path={result.path}
              onSelect={setSelected}
            />
            <div className="map-summary">
              <span>{result.nodes.length} developers</span>
              <span>{result.edges.length} connections</span>
              {(graph.nodes.length < result.nodes.length ||
                graph.edges.length < result.edges.length) && (
                <span>{graph.nodes.length} on screen · all data retained</span>
              )}
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
                    {result.nodes
                      .slice(peoplePage * 100, (peoplePage + 1) * 100)
                      .map((n) => (
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
                  {result.nodes.length > 100 && (
                    <div className="list-pagination">
                      <button
                        disabled={peoplePage === 0}
                        onClick={() => setPeoplePage((p) => p - 1)}
                      >
                        ←
                      </button>
                      <span>
                        {peoplePage * 100 + 1}–
                        {Math.min((peoplePage + 1) * 100, result.nodes.length)}{" "}
                        / {result.nodes.length}
                      </span>
                      <button
                        disabled={(peoplePage + 1) * 100 >= result.nodes.length}
                        onClick={() => setPeoplePage((p) => p + 1)}
                      >
                        →
                      </button>
                    </div>
                  )}
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
              <span>
                Drag to orbit · Scroll or WASD to travel · Click a signal to
                focus
              </span>
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
