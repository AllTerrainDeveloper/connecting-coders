import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const signal = () => new AbortController().signal;
const user = (login = "person") => ({ login, type: "User" });
describe("GitHub boundary", () => {
  it("does not bind native fetch to the adapter instance", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    vi.stubGlobal("fetch", function (this: unknown) {
      if (this instanceof GitHubClient)
        throw new TypeError("Illegal invocation");
      return Promise.resolve(Response.json(user()));
    });
    await expect(
      new GitHubClient().user("person", signal()),
    ).resolves.toMatchObject({ login: "person" });
  });
  it("cache hits do not extend the original freshness window", async () => {
    vi.useFakeTimers();
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(user())));
    const client = new GitHubClient(4, fetcher);
    await client.user("person", signal());
    vi.setSystemTime(Date.now() + 240_000);
    await client.user("person", signal());
    vi.setSystemTime(Date.now() + 70_000);
    await client.user("person", signal());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("normalizes handles and rejects invalid path input", async () => {
    const { normalizeLogin } = await import("../lib/github/client");
    expect(normalizeLogin(" @Torvalds ")).toBe("torvalds");
    for (const invalid of [
      "../users",
      "two--hyphens",
      "-foo",
      "foo-",
      "a".repeat(40),
      "",
    ])
      expect(() => normalizeLogin(invalid)).toThrow();
  });
  it("validates before caching and reuses validated responses", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ bad: "schema" }))
      .mockResolvedValue(Response.json(user()));
    const client = new GitHubClient(3, fetcher);
    await expect(client.user("person", signal())).rejects.toThrow();
    await client.user("person", signal());
    await client.user("person", signal());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(client.requests).toBe(2);
  });
  it("recognizes pagination and keeps public follow direction at the boundary", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json([user("friend")], {
        headers: {
          link: '<https://api.github.com/users/person/following?page=2>; rel="next"',
        },
      }),
    );
    const client = new GitHubClient(3, fetcher);
    expect(await client.neighbors("person", "following", signal())).toEqual({
      users: [{ login: "friend", name: undefined, avatarUrl: undefined }],
      hasMore: true,
    });
    expect(fetcher.mock.calls[0][0]).toContain("/person/following?");
  });
  it("stops before exceeding the local request budget", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi.fn().mockResolvedValue(Response.json(user()));
    const client = new GitHubClient(1, fetcher);
    await client.user("person", signal());
    await expect(client.user("another", signal())).rejects.toMatchObject({
      kind: "budget",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("honors cooldown across searches without retrying", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "retry-after": "90" } }),
      );
    await expect(
      new GitHubClient(5, fetcher).user("person", signal()),
    ).rejects.toMatchObject({ kind: "rate-limit" });
    await expect(
      new GitHubClient(5, fetcher).user("other", signal()),
    ).rejects.toMatchObject({ kind: "rate-limit" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not issue a request when already aborted", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi.fn();
    const abort = new AbortController();
    abort.abort();
    await expect(
      new GitHubClient(5, fetcher).user("person", abort.signal),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not treat an organization as a person", async () => {
    const { GitHubClient } = await import("../lib/github/client");
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ...user(), type: "Organization" }));
    await expect(
      new GitHubClient(1, fetcher).user("person", signal()),
    ).rejects.toMatchObject({ kind: "invalid" });
  });
});
