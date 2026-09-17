import { afterEach, describe, expect, it, vi } from "vitest";
import { Exploration, waitForBatch } from "../lib/graph/exploration";
import type { GraphProvider, Neighbors } from "../lib/graph/types";
const signal = () => new AbortController().signal;
function provider(
  get: (
    login: string,
    direction: string,
    page: number,
  ) => Promise<Neighbors> | Neighbors,
) {
  return {
    requests: 0,
    user: vi.fn(async (login: string) => ({ login })),
    neighbors: vi.fn(
      async (
        login: string,
        direction: string,
        _signal: AbortSignal,
        page = 1,
      ) => get(login, direction, page),
    ),
  } satisfies GraphProvider;
}
const page = (names: string[], hasMore = false) => ({
  users: names.map((login) => ({ login })),
  hasMore,
});
afterEach(() => vi.useRealTimers());
describe("complete paginated exploration", () => {
  it("reads later pages and keeps exploring after a path has been found", async () => {
    const p = provider((login, direction, n) =>
      login === "a" && direction === "following"
        ? n === 1
          ? page(["z"], true)
          : page(["later"])
        : page([]),
    );
    const session = new Exploration("a", "z", 1, "following");
    await session.next(p, signal());
    expect(session.snapshot().path).toEqual(["a", "z"]);
    expect(session.complete).toBe(false);
    await session.next(p, signal());
    await session.next(p, signal());
    expect(p.neighbors.mock.calls.map((c) => [c[0], c[1], c[3]])).toEqual([
      ["a", "following", 1],
      ["z", "followers", 1],
      ["a", "following", 2],
    ]);
    expect(session.snapshot().nodes.map((n) => n.login)).toContain("later");
    expect(session.complete).toBe(true);
    expect(session.snapshot().truncated).toBe(false);
  });
  it("retries the exact failed page without losing the cursor or prior evidence", async () => {
    let fail = true;
    const p = provider((login, direction, n) => {
      if (login === "a" && direction === "following" && n === 2 && fail)
        throw Error("quota");
      return login === "a" && direction === "following"
        ? page([n === 1 ? "b" : "z"], n === 1)
        : page([]);
    });
    const session = new Exploration("a", "z", 1, "following");
    await session.next(p, signal());
    await session.next(p, signal());
    await expect(session.next(p, signal())).rejects.toThrow("quota");
    expect(session.snapshot().pages).toBe(2);
    fail = false;
    await session.next(p, signal());
    expect(p.neighbors.mock.calls.at(-1)?.[3]).toBe(2);
    expect(session.snapshot().path).toEqual(["a", "z"]);
  });
  it("expands public lists only within the requested hop boundary", async () => {
    const p = provider((login) =>
      login === "a" ? page(["b"]) : login === "b" ? page(["c"]) : page([]),
    );
    const session = new Exploration("a", "z", 1, "following");
    while (!session.complete) await session.next(p, signal());
    expect(p.neighbors.mock.calls.some((c) => c[0] === "b")).toBe(false);
    expect(session.snapshot().nodes.map((n) => n.login)).toContain("b");
  });
  it("preserves direction when reading reverse follower pages", async () => {
    const p = provider((login, direction) =>
      login === "a"
        ? page(["b"])
        : direction === "followers"
          ? page(["b"])
          : page([]),
    );
    const session = new Exploration("a", "z", 2, "following");
    await session.next(p, signal());
    await session.next(p, signal());
    expect(session.snapshot().path).toEqual(["a", "b", "z"]);
    expect(session.snapshot().edges).toContainEqual({
      source: "b",
      target: "z",
    });
  });
  it("does not commit a page after cancellation", async () => {
    const abort = new AbortController();
    const p = provider(() => {
      abort.abort();
      return page(["b"]);
    });
    const session = new Exploration("a", "z", 2, "following");
    await expect(session.next(p, abort.signal)).rejects.toThrow();
    expect(session.snapshot().pages).toBe(0);
    expect(session.snapshot().edges).toEqual([]);
  });
});
describe("cinematic pacing", () => {
  it("holds the batch for five seconds", async () => {
    vi.useFakeTimers();
    let done = false;
    const wait = waitForBatch(5000, signal()).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(done).toBe(true);
  });
  it("cancels immediately and cleans its timer", async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const wait = waitForBatch(5000, abort.signal);
    const assertion = expect(wait).rejects.toThrow();
    abort.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("two-way discovery", () => {
  it("reads followers and following on both sides and finds incoming-only routes", async () => {
    const p = provider((login, direction) =>
      login === "a" && direction === "followers"
        ? page(["b"])
        : login === "z" && direction === "following"
          ? page(["b"])
          : page([]),
    );
    const session = new Exploration("a", "z", 2);
    while (!session.complete) await session.next(p, signal());
    expect(session.snapshot().path).toEqual(["a", "b", "z"]);
    expect(session.snapshot().edges).toEqual(
      expect.arrayContaining([
        { source: "b", target: "a" },
        { source: "z", target: "b" },
      ]),
    );
    for (const login of ["a", "z", "b"])
      for (const direction of ["followers", "following"])
        expect(
          p.neighbors.mock.calls.some(
            (c) => c[0] === login && c[1] === direction,
          ),
        ).toBe(true);
  });
  it("does not report a mutual route until reciprocal evidence arrives", async () => {
    const p = provider((login, direction) =>
      login === "a" && ["followers", "following"].includes(direction)
        ? page(["z"])
        : page([]),
    );
    const session = new Exploration("a", "z", 1, "mutual");
    await session.next(p, signal());
    expect(session.snapshot().path).toEqual([]);
    await session.next(p, signal());
    await session.next(p, signal());
    expect(session.snapshot().path).toEqual(["a", "z"]);
  });
});
