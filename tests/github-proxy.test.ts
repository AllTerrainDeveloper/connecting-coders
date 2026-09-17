import { describe, expect, it, vi } from "vitest";
import { proxyGitHub } from "../lib/github/proxy";
const request = (path: string) =>
  new Request(`http://localhost/api/github/${path}`);
describe("server credential boundary", () => {
  it("authenticates upstream while returning only public profile fields", async () => {
    const transport = vi.fn().mockResolvedValue(
      Response.json(
        { login: "a", type: "User", private_gists: 9 },
        {
          headers: {
            "x-ratelimit-remaining": "4999",
            "set-cookie": "secret",
            "x-oauth-scopes": "repo",
          },
        },
      ),
    );
    const response = await proxyGitHub(
      request("users/a"),
      "test-secret",
      transport,
    );
    expect(transport).toHaveBeenCalledWith(
      "https://api.github.com/users/a",
      expect.objectContaining({
        redirect: "manual",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
        }),
      }),
    );
    expect(await response.json()).toEqual({ login: "a", type: "User" });
    expect(response.headers.get("x-ratelimit-remaining")).toBe("4999");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(response.headers.has("x-oauth-scopes")).toBe(false);
  });
  it("rejects private endpoints, injected queries and writes before using credentials", async () => {
    const transport = vi.fn();
    for (const path of [
      "user",
      "repos/a/b",
      "users/a/repos",
      "users/a?url=https://evil.test",
      "users/a/followers?page=-1",
      "users/a/followers?page=1&page=2",
      "users/a/followers?per_page=1",
      "session?url=foo",
    ])
      expect(
        (await proxyGitHub(request(path), "secret", transport)).status,
      ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await proxyGitHub(
          new Request("http://localhost/api/github/users/a", {
            method: "POST",
          }),
          "secret",
          transport,
        )
      ).status,
    ).toBe(405);
    expect(transport).not.toHaveBeenCalled();
  });
  it("reports actual quota and supports anonymous fallback without sending Authorization", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          resources: { core: { limit: 60, remaining: 40, reset: 123 } },
        }),
      );
    const response = await proxyGitHub(
      request("session"),
      undefined,
      transport,
    );
    expect(await response.json()).toEqual({
      authenticated: false,
      limit: 60,
      remaining: 40,
      reset: 123,
    });
    expect(transport.mock.calls[0][1].headers).not.toHaveProperty(
      "Authorization",
    );
  });
  it("preserves rate-limit cooldown headers without echoing upstream error details", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: "secret" },
          { status: 429, headers: { "retry-after": "90" } },
        ),
      );
    const response = await proxyGitHub(request("users/a"), "secret", transport);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("90");
    expect(await response.text()).not.toContain("secret");
  });
  it("does not leak transport exceptions", async () => {
    const transport = vi.fn().mockRejectedValue(new Error("Bearer secret"));
    const response = await proxyGitHub(request("users/a"), "secret", transport);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
  });
});

it("rejects upstream redirects without forwarding their destination or credentials", async () => {
  const transport = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://untrusted.test" } }));
  const response = await proxyGitHub(request("users/a"), "secret", transport);
  expect(response.status).toBe(502);
  expect(response.headers.has("location")).toBe(false);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1].redirect).toBe("manual");
});
