"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { demo } from "@/lib/graph/demo";
import { GitHubClient, normalizeLogin } from "@/lib/github/client";
import { searchConnections } from "@/lib/graph/search";
import type { SearchResult } from "@/lib/graph/types";
export function useConnectionSearch() {
  const [result, setResult] = useState<SearchResult>(demo);
  const [isDemo, setDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);
  const search = useCallback(
    async (sourceInput: string, targetInput: string, maxHops: number) => {
      let source: string, target: string;
      try {
        source = normalizeLogin(sourceInput);
        target = normalizeLogin(targetInput);
      } catch (error) {
        setError((error as Error).message);
        return;
      }
      controller.current?.abort();
      const current = ++generation.current;
      const abort = new AbortController();
      controller.current = abort;
      setBusy(true);
      setError("");
      setDemo(false);
      setResult({
        nodes: [],
        edges: [],
        path: [],
        requests: 0,
        expanded: 0,
        truncated: true,
        outcome: "limited",
      });
      const provider = new GitHubClient(24);
      try {
        const result = await searchConnections(
          provider,
          source,
          target,
          abort.signal,
          {
            maxHops,
            maxExpansions: 22,
            maxNodes: 400,
            onProgress: (progress) => {
              if (generation.current === current)
                setResult({ ...progress, path: [], outcome: "limited" });
            },
          },
        );
        if (generation.current === current) setResult(result);
      } catch (error) {
        if (generation.current === current)
          setError(
            abort.signal.aborted
              ? "Search stopped. The connections discovered so far are still available."
              : error instanceof Error
                ? error.message
                : "The search could not finish. Please try again.",
          );
      } finally {
        if (generation.current === current) {
          setBusy(false);
          setResult((previous) => ({
            ...previous,
            requests: provider.requests,
            remaining: provider.remaining,
          }));
        }
      }
    },
    [],
  );
  const showDemo = useCallback(() => {
    controller.current?.abort();
    generation.current++;
    setBusy(false);
    setError("");
    setDemo(true);
    setResult(demo);
  }, []);
  return { result, isDemo, busy, error, search, cancel, showDemo };
}
