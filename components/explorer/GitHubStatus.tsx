"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ShieldCheck, Radio } from "lucide-react";
const schema = z.object({
  authenticated: z.boolean(),
  limit: z.number(),
  remaining: z.number(),
  reset: z.number(),
});
export default function GitHubStatus({ remaining }: { remaining?: number }) {
  const [status, setStatus] = useState<z.infer<typeof schema> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/github/session", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const status = schema.parse(await response.json());
        if (!abort.signal.aborted) setStatus(status);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, []);
  return (
    <div className="github-status" aria-live="polite">
      {status?.authenticated ? <ShieldCheck size={15} /> : <Radio size={15} />}
      <div>
        <strong>
          {failed
            ? "GitHub connection unavailable"
            : !status
              ? "Checking GitHub connection…"
              : status.authenticated
                ? "GitHub authenticated"
                : "GitHub anonymous access"}
        </strong>
        {status && (
          <span>
            {(remaining ?? status.remaining).toLocaleString()} /{" "}
            {status.limit.toLocaleString()} requests remaining
          </span>
        )}
      </div>
    </div>
  );
}
