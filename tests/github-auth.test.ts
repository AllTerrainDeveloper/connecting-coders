import { describe, expect, it, vi } from "vitest";
import { GitHubAuth, type AuthConfig } from "../lib/github/auth/service";
import { digest, seal, unseal } from "../lib/github/auth/crypto";
import type { Attempt, AuthStore, Session } from "../lib/github/auth/store";
class MemoryStore implements AuthStore {
  attempts = new Map<string, Attempt>();
  sessions = new Map<string, Session>();
  async saveAttempt(value: Attempt) {
    this.attempts.set(value.stateHash, value);
  }
  async consumeAttempt(id: string, viewer: string, now: number) {
    const a = this.attempts.get(id);
    if (!a || a.viewer !== viewer || a.expires <= now) return null;
    this.attempts.delete(id);
    return a;
  }
  async saveSession(value: Session) {
    this.sessions.set(value.idHash, value);
  }
  async getSession(id: string, viewer: string, now: number) {
    const s = this.sessions.get(id);
    return s && s.viewer === viewer && s.expires > now ? s : null;
  }
  async deleteSession(id: string, viewer: string) {
    if (this.sessions.get(id)?.viewer === viewer) this.sessions.delete(id);
  }
  async cleanup(now: number) {
    for (const [id, a] of this.attempts)
      if (a.expires <= now) this.attempts.delete(id);
    for (const [id, s] of this.sessions)
      if (s.expires <= now) this.sessions.delete(id);
  }
}
const config: AuthConfig = {
  clientId: "client",
  clientSecret: "app-secret",
  encryptionKey: "ab".repeat(32),
  origin: "https://site.test",
};
function request(
  path: string,
  cookie = "",
  method = "GET",
  origin = config.origin,
) {
  return new Request(config.origin + path, {
    method,
    headers: { cookie, origin },
  });
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
function fixture() {
  const store = new MemoryStore();
  let now = 1000;
  const transport = vi
    .fn()
    .mockImplementation(async (url: string) =>
      url.includes("access_token")
        ? Response.json({
            access_token: "user-token",
            token_type: "bearer",
            scope: "",
            expires_in: 3600,
          })
        : Response.json({ login: "alice" }),
    );
  const auth = new GitHubAuth(config, store, transport, () => now);
  const start = () =>
    auth.start(request("/api/github/auth/start", "", "POST"), "viewer-a");
  const finish = (response: Response, viewer = "viewer-a") => {
    const state = new URL(response.headers.get("location")!).searchParams.get(
      "state",
    );
    return auth.callback(
      request(
        `/api/github/auth/callback?state=${state}&code=code`,
        cookies(response),
      ),
      viewer,
    );
  };
  return {
    auth,
    store,
    transport,
    start,
    finish,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe("per-visitor GitHub OAuth sessions", () => {
  it("uses state and S256 PKCE, requests no additional scopes and encrypts stored secrets", async () => {
    const f = fixture(),
      response = await f.start();
    const url = new URL(response.headers.get("location")!);
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("scope")).toBe("");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const a = [...f.store.attempts.values()][0];
    expect(a.stateHash).toBe(await digest(url.searchParams.get("state")!));
    const verifier = await unseal(
      a.verifier,
      config.encryptionKey,
      `pkce:viewer-a:${a.stateHash}`,
    );
    expect(await digest(verifier)).toBe(url.searchParams.get("code_challenge"));
    const complete = await f.finish(response);
    expect(complete.headers.get("location")).toBe(
      "https://site.test/?github=connected",
    );
    const s = [...f.store.sessions.values()][0];
    expect(s.token).not.toContain("user-token");
    expect(complete.headers.get("set-cookie")).not.toContain("user-token");
    const cookie = cookies(complete);
    expect(
      (
        await f.auth.credential(
          request("/api/github/users/a", cookie),
          "viewer-a",
        )
      )?.token,
    ).toBe("user-token");
    expect(
      await f.auth.credential(
        request("/api/github/users/a", cookie),
        "viewer-b",
      ),
    ).toBeNull();
    expect(
      complete.headers
        .getSetCookie()
        .find((c) => c.startsWith("cc_github_session=")),
    ).toMatch(/HttpOnly; SameSite=Lax; Secure$/);
    const exchange = f.transport.mock.calls[0][1];
    expect(exchange.body.get("code_verifier")).toBe(verifier);
    expect(exchange.body.get("redirect_uri")).toBe(
      `${config.origin}/api/github/auth/callback`,
    );
  });
  it("rejects cross-origin starts and logouts", async () => {
    const f = fixture();
    for (const action of ["start", "logout"] as const)
      expect(
        (
          await f.auth[action](
            request(
              `/api/github/auth/${action}`,
              "",
              "POST",
              "https://evil.test",
            ),
            "viewer-a",
          )
        ).status,
      ).toBe(403);
    expect(f.store.attempts.size).toBe(0);
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("rejects mismatched state, wrong viewers and replayed callbacks", async () => {
    const f = fixture(),
      start = await f.start();
    const wrong = await f.auth.callback(
      request(
        "/api/github/auth/callback?state=wrong&code=code",
        cookies(start),
      ),
      "viewer-a",
    );
    expect(wrong.headers.get("location")).toContain("failed");
    expect(
      (await f.finish(start, "viewer-b")).headers.get("location"),
    ).toContain("failed");
    expect(f.transport).not.toHaveBeenCalled();
    await f.finish(start);
    const count = f.transport.mock.calls.length;
    expect((await f.finish(start)).headers.get("location")).toContain("failed");
    expect(f.transport).toHaveBeenCalledTimes(count);
  });
  it("expires attempts and caps session lifetime at the GitHub token expiry", async () => {
    const f = fixture(),
      stale = await f.start();
    f.advance(600001);
    expect((await f.finish(stale)).headers.get("location")).toContain("failed");
    const complete = await f.finish(await f.start());
    f.advance(3600001);
    expect(
      await f.auth.credential(request("/", cookies(complete)), "viewer-a"),
    ).toBeNull();
  });
  it("ends the server session on disconnect, even if the cookie is replayed", async () => {
    const f = fixture(),
      complete = await f.finish(await f.start()),
      cookie = cookies(complete);
    const logout = await f.auth.logout(
      request("/api/github/auth/logout", cookie, "POST"),
      "viewer-a",
    );
    expect(logout.headers.get("location")).toContain("disconnected");
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      await f.auth.credential(request("/", cookie), "viewer-a"),
    ).toBeNull();
    expect(f.store.sessions.size).toBe(0);
  });
  it("handles denied access without exchanging a code", async () => {
    const f = fixture(),
      start = await f.start();
    const state = new URL(start.headers.get("location")!).searchParams.get(
      "state",
    );
    const response = await f.auth.callback(
      request(
        `/api/github/auth/callback?state=${state}&error=access_denied`,
        cookies(start),
      ),
      "viewer-a",
    );
    expect(response.headers.get("location")).toContain("cancelled");
    expect(f.transport).not.toHaveBeenCalled();
    expect(f.store.attempts.size).toBe(0);
  });
  it("never establishes a session on upstream failure or over-scoped grants", async () => {
    for (const failure of [
      new Response("bad", { status: 502 }),
      Response.json({
        access_token: "secret",
        token_type: "bearer",
        scope: "repo",
      }),
    ]) {
      const f = fixture();
      f.transport.mockResolvedValueOnce(failure);
      const response = await f.finish(await f.start());
      expect(response.headers.get("location")).toContain("failed");
      expect(f.store.sessions.size).toBe(0);
    }
  });
  it("binds encrypted credentials to their session and owner and detects tampering", async () => {
    const value = await seal("token", config.encryptionKey, "owner-a");
    await expect(
      unseal(value, config.encryptionKey, "owner-b"),
    ).rejects.toThrow();
    const changed = (value[0] === "a" ? "b" : "a") + value.slice(1);
    await expect(
      unseal(changed, config.encryptionKey, "owner-a"),
    ).rejects.toThrow();
  });
});
