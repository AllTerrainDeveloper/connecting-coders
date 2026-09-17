import { z } from "zod";
import { digest, randomToken, seal, unseal } from "./crypto";
import type { AuthStore } from "./store";

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  origin: string;
}
const STATE_COOKIE = "cc_github_state";
const SESSION_COOKIE = "cc_github_session";
const TEN_MINUTES = 600_000;
const EIGHT_HOURS = 8 * 60 * 60_000;
const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("bearer"),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional(),
});
const accountSchema = z.object({ login: z.string().min(1) });
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
function cookieValue(request: Request, name: string) {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export class GitHubAuth {
  constructor(
    private config: AuthConfig,
    private store: AuthStore,
    private transport: typeof fetch = (input, init) => fetch(input, init),
    private now = () => Date.now(),
  ) {}
  private cookie(name: string, value: string, maxAge?: number) {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${this.config.origin.startsWith("https:") ? "; Secure" : ""}${maxAge === undefined ? "" : `; Max-Age=${maxAge}`}`;
  }
  private redirect(path: string, cookies: string[] = []) {
    const headers = new Headers({
      ...privateHeaders,
      Location: new URL(path, this.config.origin).href,
    });
    for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 303, headers });
  }
  private sameOrigin(request: Request) {
    return (
      request.method === "POST" &&
      request.headers.get("origin") === this.config.origin &&
      new URL(request.url).origin === this.config.origin &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  }
  private async getSession(request: Request, viewer: string) {
    const id = cookieValue(request, SESSION_COOKIE);
    return id
      ? this.store.getSession(await digest(id), viewer, this.now())
      : null;
  }
  async credential(request: Request, viewer: string) {
    const session = await this.getSession(request, viewer);
    if (!session) return null;
    try {
      return {
        ...session,
        token: await unseal(
          session.token,
          this.config.encryptionKey,
          `token:${viewer}:${session.idHash}`,
        ),
      };
    } catch {
      await this.store.deleteSession(session.idHash, viewer);
      return null;
    }
  }
  async forget(request: Request, viewer: string) {
    const id = cookieValue(request, SESSION_COOKIE);
    if (id) await this.store.deleteSession(await digest(id), viewer);
  }
  async start(request: Request, viewer: string) {
    if (!this.sameOrigin(request))
      return new Response(null, { status: 403, headers: privateHeaders });
    await this.store.cleanup(this.now());
    const state = randomToken(),
      verifier = randomToken(),
      stateHash = await digest(state);
    await this.store.saveAttempt({
      stateHash,
      viewer,
      verifier: await seal(
        verifier,
        this.config.encryptionKey,
        `pkce:${viewer}:${stateHash}`,
      ),
      expires: this.now() + TEN_MINUTES,
    });
    const authorization = new URL("https://github.com/login/oauth/authorize");
    authorization.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: `${this.config.origin}/api/github/auth/callback`,
      scope: "",
      state,
      code_challenge: await digest(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return this.redirect(authorization.href, [
      this.cookie(STATE_COOKIE, state, 600),
    ]);
  }
  async callback(request: Request, viewer: string) {
    const url = new URL(request.url),
      state = url.searchParams.get("state");
    const clear = this.cookie(STATE_COOKIE, "", 0);
    const fail = () => this.redirect("/?github=failed", [clear]);
    if (
      request.method !== "GET" ||
      url.origin !== this.config.origin ||
      !state ||
      state !== cookieValue(request, STATE_COOKIE) ||
      url.searchParams.getAll("state").length !== 1
    )
      return fail();
    const attempt = await this.store.consumeAttempt(
      await digest(state),
      viewer,
      this.now(),
    );
    if (!attempt) return fail(); // Atomic consumption makes callbacks single-use, including failures.
    if (url.searchParams.has("error"))
      return this.redirect("/?github=cancelled", [clear]);
    const code = url.searchParams.get("code");
    if (
      !code ||
      code.length > 1024 ||
      url.searchParams.getAll("code").length !== 1
    )
      return fail();
    try {
      const verifier = await unseal(
        attempt.verifier,
        this.config.encryptionKey,
        `pkce:${viewer}:${attempt.stateHash}`,
      );
      const tokenResponse = await this.transport(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(12_000),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: `${this.config.origin}/api/github/auth/callback`,
            code_verifier: verifier,
          }),
        },
      );
      if (!tokenResponse.ok) return fail();
      const token = tokenSchema.parse(await tokenResponse.json());
      // This integration is public-data only. Reject accidentally over-scoped app grants.
      if (token.scope?.trim()) return fail();
      const profileResponse = await this.transport(
        "https://api.github.com/user",
        {
          redirect: "error",
          signal: AbortSignal.timeout(12_000),
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Connecting-Coders",
            Authorization: `Bearer ${token.access_token}`,
          },
        },
      );
      if (!profileResponse.ok) return fail();
      const profile = accountSchema.parse(await profileResponse.json());
      const id = randomToken(),
        idHash = await digest(id);
      await this.store.saveSession({
        idHash,
        viewer,
        login: profile.login,
        token: await seal(
          token.access_token,
          this.config.encryptionKey,
          `token:${viewer}:${idHash}`,
        ),
        expires:
          this.now() +
          Math.min(
            EIGHT_HOURS,
            (token.expires_in ?? EIGHT_HOURS / 1000) * 1000,
          ),
      });
      await this.forget(request, viewer);
      // Session cookie (no persistent Max-Age); the server additionally enforces an 8-hour ceiling.
      return this.redirect("/?github=connected", [
        clear,
        this.cookie(SESSION_COOKIE, id),
      ]);
    } catch {
      return fail();
    }
  }
  async logout(request: Request, viewer: string) {
    if (!this.sameOrigin(request))
      return new Response(null, { status: 403, headers: privateHeaders });
    await this.forget(request, viewer);
    return this.redirect("/?github=disconnected", [
      this.cookie(SESSION_COOKIE, "", 0),
      this.cookie(STATE_COOKIE, "", 0),
    ]);
  }
}
