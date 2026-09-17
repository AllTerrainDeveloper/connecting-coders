"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { demo } from "@/lib/graph/demo";
import { GitHubClient, normalizeLogin } from "@/lib/github/client";
import {
  Exploration,
  waitForBatch,
  type DiscoveryBatch,
} from "@/lib/graph/exploration";
import type { SearchResult, ConnectionMode } from "@/lib/graph/types";
export type ExplorationPhase =
  "idle" | "fetching" | "revealing" | "paused" | "complete";
export function useConnectionSearch() {
  const [result, setResult] = useState<SearchResult>(demo);
  const [isDemo, setDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<ExplorationPhase>("idle");
  const [batch, setBatch] = useState<DiscoveryBatch | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const session = useRef<Exploration | null>(null);
  const requestTotal = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const cancel = useCallback(() => controller.current?.abort(), []);
  const run = useCallback(async (exploration: Exploration) => {
    controller.current?.abort();
    const current = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    const provider = new GitHubClient(Number.POSITIVE_INFINITY);
    const previousRequests = requestTotal.current;
    setBusy(true);
    setError("");
    setPhase("fetching");
    const publish = () => {
      if (generation.current === current)
        setResult(
          exploration.snapshot(
            previousRequests + provider.requests,
            provider.remaining,
          ),
        );
    };
    try {
      await exploration.initialize(provider, abort.signal);
      publish();
      while (!exploration.complete) {
        abort.signal.throwIfAborted();
        setPhase("fetching");
        const batch = await exploration.next(provider, abort.signal);
        if (generation.current !== current) return;
        publish();
        if (!batch) break;
        setBatch(batch);
        setPhase("revealing");
        // Every real page receives its own five-second scene, including cached pages.
        await waitForBatch(5000, abort.signal);
      }
      if (generation.current === current) setPhase("complete");
    } catch (error) {
      if (generation.current === current) {
        setPhase("paused");
        setError(
          abort.signal.aborted
            ? "Exploration paused. Resume from the next unexamined page."
            : error instanceof Error
              ? error.message
              : "Exploration paused. You can retry this page.",
        );
      }
    } finally {
      if (generation.current === current) {
        requestTotal.current = previousRequests + provider.requests;
        publish();
        setBusy(false);
      }
    }
  }, []);
  const search = useCallback(
    async (
      sourceInput: string,
      targetInput: string,
      maxHops: number,
      mode: ConnectionMode = "either",
    ) => {
      let source: string, target: string;
      try {
        source = normalizeLogin(sourceInput);
        target = normalizeLogin(targetInput);
      } catch (error) {
        setError((error as Error).message);
        return;
      }
      controller.current?.abort();
      session.current = new Exploration(source, target, maxHops, mode);
      requestTotal.current = 0;
      setDemo(false);
      setBatch(null);
      setResult(session.current.snapshot());
      await run(session.current);
    },
    [run],
  );
  const resume = useCallback(() => {
    if (session.current && !session.current.complete) void run(session.current);
  }, [run]);
  const showDemo = useCallback(() => {
    controller.current?.abort();
    generation.current++;
    session.current = null;
    setBusy(false);
    setError("");
    setDemo(true);
    setPhase("idle");
    setResult(demo);
    setBatch(null);
  }, []);
  return {
    result,
    isDemo,
    busy,
    error,
    phase,
    batch,
    search,
    cancel,
    resume,
    showDemo,
    canResume: phase === "paused" && !isDemo && result.truncated,
  };
}
