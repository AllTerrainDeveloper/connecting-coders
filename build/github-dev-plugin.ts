import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";
import { proxyGitHub } from "../lib/github/proxy";

/** Opt-in local sign-in. The credential stays in the development server's memory:
 * no env file, Vite define, Worker binding, build output, or browser storage. */
export function githubDevAuth(): Plugin {
  return {
    name: "connecting-coders-local-github",
    apply: "serve",
    configureServer(server) {
      let token: string | undefined;
      if (process.env.CONNECTING_CODERS_GH_AUTH === "1")
        try {
          token = execFileSync(
            "gh",
            ["auth", "token", "--hostname", "github.com"],
            {
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
              timeout: 5000,
            },
          ).trim();
          if (!token) throw new Error("Missing credential");
        } catch {
          throw new Error(
            "GitHub CLI sign-in is unavailable. Run gh auth login, then restart dev:github.",
          );
        }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/github/")) return next();
        const host = req.headers.host ?? "";
        const origin = req.headers.origin;
        if (
          !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
          (origin && origin !== `http://${host}`) ||
          req.headers["sec-fetch-site"] === "cross-site"
        ) {
          res.writeHead(403).end();
          return;
        }
        const abort = new AbortController();
        const cancel = () => abort.abort();
        res.on("close", cancel);
        try {
          const response = await proxyGitHub(
            new Request(`http://${host}${req.url}`, {
              method: req.method,
              signal: abort.signal,
            }),
            token,
          );
          if (!res.destroyed) {
            res.writeHead(
              response.status,
              Object.fromEntries(response.headers),
            );
            res.end(await response.text());
          }
        } finally {
          res.off("close", cancel);
        }
      });
    },
  };
}
