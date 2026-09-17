import { env } from "cloudflare:workers";
import { GitHubAuth } from "./service";
import { D1AuthStore } from "./store";

export function githubAuth() {
  const {
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_SESSION_KEY,
    GITHUB_APP_URL,
    DB,
  } = env;
  if (
    !DB ||
    !GITHUB_CLIENT_ID ||
    !GITHUB_CLIENT_SECRET ||
    !GITHUB_SESSION_KEY ||
    !GITHUB_APP_URL
  )
    return null;
  const url = new URL(GITHUB_APP_URL);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Invalid GitHub app origin");
  return new GitHubAuth(
    {
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      encryptionKey: GITHUB_SESSION_KEY,
      origin: url.origin,
    },
    new D1AuthStore(DB),
  );
}
