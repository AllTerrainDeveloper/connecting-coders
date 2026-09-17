"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Network,
  Route,
  X,
} from "lucide-react";
import { connectionReport, reportText } from "@/lib/graph/report";
import type { SearchResult } from "@/lib/graph/types";

export default function ConnectionReport({
  result,
  busy,
  isDemo,
}: {
  result: SearchResult;
  busy: boolean;
  isDemo: boolean;
}) {
  const [open, setOpen] = useState(!isDemo);
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const report = useMemo(() => connectionReport(result), [result]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  if (!report) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(result, isDemo));
      setCopyStatus("Report copied");
    } catch {
      setCopyStatus("Copy unavailable. You can select the report text.");
    }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyStatus(""), 4000);
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={`report-trigger${isDemo ? " is-sample" : ""}`}>
        <FileText size={17} />
        <span>{isDemo ? "Preview sample report" : "Connection report"}</span>
        {!isDemo && (
          <span className="report-trigger-count">{report.hops} hops</span>
        )}
        <ArrowRight size={15} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="report-backdrop" />
        <Dialog.Content className="connection-report">
          <div className="report-topline">
            <span>
              <Network size={15} /> CONNECTING CODERS /{" "}
              {isDemo ? "SIMULATION" : "CONNECTION INTELLIGENCE"}
            </span>
            <Dialog.Close
              className="report-close"
              aria-label="Close connection report"
            >
              <X size={21} />
            </Dialog.Close>
          </div>
          <div className="report-scroll">
            <header className="report-hero">
              <span className="report-status">
                <i /> {isDemo ? "ILLUSTRATIVE SIGNAL" : "CONNECTION FOUND"}
              </span>
              <Dialog.Title className="report-title">
                There’s a way <em>in.</em>
              </Dialog.Title>
              <Dialog.Description className="report-description">
                {report.hops === 0 ? (
                  "You’ve reached your own account."
                ) : (
                  <>
                    From <strong>@{report.source}</strong> to{" "}
                    <strong>@{report.target}</strong>. Follow the people behind
                    the path.
                  </>
                )}
              </Dialog.Description>
              <div className="report-metrics">
                <div>
                  <strong>{String(report.hops).padStart(2, "0")}</strong>
                  <span>
                    {report.hops === 1
                      ? "hop to destination"
                      : "hops to destination"}
                  </span>
                </div>
                <div>
                  <strong>
                    {String(report.intermediaries).padStart(2, "0")}
                  </strong>
                  <span>
                    {report.intermediaries === 1
                      ? "person in between"
                      : "people in between"}
                  </span>
                </div>
                <div className="report-mode">
                  <Route size={22} />
                  <span>
                    {result.mode === "mutual"
                      ? "Mutual follows"
                      : result.mode === "following"
                        ? "Following"
                        : "Followers + following"}
                  </span>
                </div>
              </div>
            </header>
            <div className="report-body">
              <section
                className="report-route"
                aria-label="Reported connection route"
              >
                <h3>
                  <span>01</span> THE HUMAN PATH
                </h3>
                <ol key={result.path.join(">")}>
                  {report.steps.map((step, index) => (
                    <li
                      key={step.login}
                      style={{ animationDelay: `${150 + index * 150}ms` }}
                    >
                      <div
                        className={`report-node${index === 0 || index === report.steps.length - 1 ? " endpoint" : ""}`}
                      >
                        {String(index).padStart(2, "0")}
                      </div>
                      <div className="report-person">
                        <span className="report-role">
                          {index === 0
                            ? "STARTING POINT"
                            : index === report.steps.length - 1
                              ? "DESTINATION"
                              : "POSSIBLE INTRODUCTION"}
                        </span>
                        <strong>{step.name}</strong>
                        {isDemo ? (
                          <span className="report-handle">@{step.login}</span>
                        ) : (
                          <a
                            href={`https://github.com/${encodeURIComponent(step.login)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            @{step.login} <ExternalLink size={12} />
                          </a>
                        )}
                        {index < report.steps.length - 1 && (
                          <div className="report-evidence">
                            {step.evidence.length ? (
                              step.evidence.map((edge) => (
                                <p key={`${edge.source}>${edge.target}`}>
                                  <span>@{edge.source}</span>
                                  <ArrowRight size={12} aria-label="follows" />
                                  <span>@{edge.target}</span>
                                </p>
                              ))
                            ) : (
                              <p>Follow evidence unavailable.</p>
                            )}
                            <small>
                              {step.evidence.length === 2
                                ? "Mutual follow · both directions observed"
                                : "Observed follow direction"}
                            </small>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <aside className="report-context">
                <h3>
                  <span>02</span> THE CONTEXT
                </h3>
                <div className="report-context-card">
                  <span className="report-live">
                    <i className={busy ? "is-live" : ""} />
                    {isDemo
                      ? "Sample data"
                      : busy
                        ? "Exploration continues"
                        : result.truncated
                          ? "Exploration paused"
                          : "Exploration complete"}
                  </span>
                  <p>
                    {isDemo
                      ? "This report uses fictional people and follows to preview the experience."
                      : "The shortest route in the evidence collected so far. This report updates as new connections arrive."}
                  </p>
                  <dl>
                    <div>
                      <dt>Developers discovered</dt>
                      <dd>{result.nodes.length.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Public follows observed</dt>
                      <dd>{result.edges.length.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Pages explored</dt>
                      <dd>{(result.pages ?? 0).toLocaleString()}</dd>
                    </div>
                  </dl>
                  {!isDemo && result.truncated && (
                    <p className="report-coverage">
                      There is more to explore. A shorter route may still
                      emerge.
                    </p>
                  )}
                </div>
                <div className="report-next">
                  <span>MAKE IT HUMAN</span>
                  <h4>A path is a starting point.</h4>
                  <p>
                    Review the profiles along the route. Someone you already
                    know may be able to introduce you.
                  </p>
                  <small>
                    A public follow doesn’t confirm a personal relationship or a
                    willingness to introduce.
                  </small>
                </div>
              </aside>
            </div>
          </div>
          <footer className="report-actions">
            <div>
              <button type="button" onClick={copy}>
                {copyStatus === "Report copied" ? (
                  <Check size={16} />
                ) : (
                  <Copy size={16} />
                )}{" "}
                Copy report
              </button>
              <span role="status">{copyStatus}</span>
            </div>
            <Dialog.Close className="report-return">
              Back to the network <ArrowRight size={17} />
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
