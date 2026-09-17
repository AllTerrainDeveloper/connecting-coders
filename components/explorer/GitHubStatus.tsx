"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GitFork, ShieldCheck, LogOut, LoaderCircle } from "lucide-react";
const schema = z.object({
  configured: z.boolean(),
  authenticated: z.boolean(),
  needsSiteSignIn: z.boolean(),
  login: z.string().optional(),
  expires: z.number().optional(),
  expired: z.boolean().optional(),
  limit: z.number().optional(),
  remaining: z.number().optional(),
});
const messages: Record<string, string> = {
  failed: "GitHub couldn’t connect. Please try again.",
  cancelled: "GitHub sign-in was cancelled. You can try again anytime.",
  disconnected: "Your GitHub session has ended.",
};
export default function GitHubStatus({
  remaining,
  searchError,
  onConnected,
}: {
  remaining?: number;
  searchError: string;
  onConnected: (connected: boolean) => void;
}) {
  const [status, setStatus] = useState<z.infer<typeof schema> | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active: AbortController | undefined;
    const refresh = async () => {
      active?.abort();
      const abort = new AbortController();
      active = abort;
      try {
        const response = await fetch("/api/github/session", {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Unavailable");
        const value = schema.parse(await response.json());
        if (abort.signal.aborted) return;
        const url = new URL(window.location.href);
        const outcome = url.searchParams.get("github");
        if (outcome) {
          setMessage(messages[outcome] ?? "");
          url.searchParams.delete("github");
          window.history.replaceState(
            null,
            "",
            url.pathname + url.search + url.hash,
          );
        }

        setStatus(value);
        setFailed(false);
        onConnected(value.authenticated);
      } catch {
        if (!abort.signal.aborted) {
          setFailed(true);
          onConnected(false);
        }
      }
    };
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active?.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [onConnected, retry, searchError]);
  return (
    <section className="github-account" aria-label="GitHub account">
      <div className="github-status" aria-live="polite">
        {status?.authenticated ? (
          <ShieldCheck size={17} />
        ) : !status && !failed ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <GitFork size={17} />
        )}
        <div>
          <strong>
            {failed
              ? "GitHub connection unavailable"
              : !status
                ? "Checking your session…"
                : status.authenticated
                  ? `Connected as @${status.login}`
                  : "Your GitHub, your connections"}
          </strong>
          {status?.authenticated ? (
            <span>
              {status.limit !== undefined
                ? `${(remaining ?? status.remaining ?? 0).toLocaleString()} / ${status.limit.toLocaleString()} requests remaining`
                : "Using your GitHub allowance"}
            </span>
          ) : (
            <span>Connect for a personal exploration session.</span>
          )}
        </div>
      </div>
      {failed ? (
        <button
          type="button"
          className="github-connect"
          onClick={() => setRetry((n) => n + 1)}
        >
          Retry connection
        </button>
      ) : status?.needsSiteSignIn ? (
        <a
          className="github-connect"
          href="/signin-with-chatgpt?return_to=%2F"
          target="_top"
        >
          Sign in to continue
        </a>
      ) : status?.authenticated ? (
        <form action="/api/github/auth/logout" method="post" target="_top">
          <button type="submit" className="github-disconnect">
            <LogOut size={14} /> Disconnect GitHub
          </button>
        </form>
      ) : (
        <form action="/api/github/auth/start" method="post" target="_top">
          <button
            type="submit"
            className="github-connect"
            disabled={!status?.configured}
          >
            <GitFork size={17} /> Connect GitHub
          </button>
          {status && !status.configured && (
            <p className="github-notice">
              GitHub sign-in is awaiting the app owner’s setup.
            </p>
          )}
        </form>
      )}
      {(message || status?.expired) && (
        <p className="github-notice" role="status">
          {status?.expired
            ? "Your GitHub session expired. Connect again to continue."
            : message}
        </p>
      )}
    </section>
  );
}
