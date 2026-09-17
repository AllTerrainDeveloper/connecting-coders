import { digest, randomToken } from "./crypto";
import type { GitHubAuth } from "./service";

// A browser nonce binds OAuth attempts and sessions without depending on a
// hosting provider's identity headers. It is not an authentication credential.
function name(request: Request) {
  return new URL(request.url).protocol === "https:"
    ? "__Host-cc_browser"
    : "cc_browser";
}
function nonce(request: Request) {
  const prefix = `${name(request)}=`;
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(prefix.length);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export async function browserIdentity(request: Request) {
  const value = nonce(request);
  return value ? digest(value) : null;
}
export async function startBrowserLogin(auth: GitHubAuth, request: Request) {
  const existing = nonce(request);
  const value = existing ?? randomToken();
  const response = await auth.start(request, await digest(value));
  // Only establish the binding after same-origin validation has succeeded.
  if (!existing && response.status === 303) {
    response.headers.append(
      "Set-Cookie",
      `${name(request)}=${value}; Path=/; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    );
  }
  return response;
}
