import { z } from "zod";

const publicUser = z.object({
  login: z.string(),
  type: z.string(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().url().optional(),
});
const quota = z.object({
  resources: z.object({
    core: z.object({
      limit: z.number(),
      remaining: z.number(),
      reset: z.number(),
    }),
  }),
});
const login = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const responseHeaders = { "Cache-Control": "no-store" };
function failure(message: string, status: number) {
  return Response.json({ message }, { status, headers: responseHeaders });
}

/** Only public user profiles and follow lists can cross this credential boundary. */
export async function proxyGitHub(
  request: Request,
  token: string | undefined,
  transport: typeof fetch = (input, init) => fetch(input, init),
): Promise<Response> {
  if (request.method !== "GET") return failure("Method not allowed.", 405);
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/github\//, "").split("/");
  const session = parts.length === 1 && parts[0] === "session";
  let path = "/rate_limit";
  if (session) {
    if (url.search) return failure("Invalid query.", 400);
  } else {
    if (
      parts[0] !== "users" ||
      !login.test(parts[1] ?? "") ||
      parts.length < 2 ||
      parts.length > 3 ||
      (parts.length === 3 && !["followers", "following"].includes(parts[2]))
    )
      return failure("Unknown public GitHub endpoint.", 404);
    path = `/users/${parts[1].toLowerCase()}`;
    if (parts.length === 3) {
      const page = url.searchParams.get("page") ?? "1";
      if (
        !/^[1-9]\d{0,6}$/.test(page) ||
        [...url.searchParams.keys()].some(
          (key) => !["page", "per_page"].includes(key),
        ) ||
        [...url.searchParams.keys()].some(
          (key) => url.searchParams.getAll(key).length > 1,
        ) ||
        (url.searchParams.has("per_page") &&
          url.searchParams.get("per_page") !== "100")
      )
        return failure("Invalid pagination.", 400);
      path += `/${parts[2]}?per_page=100&page=${page}`;
    } else if (url.search) return failure("Invalid query.", 400);
  }
  try {
    const upstream = await transport(`https://api.github.com${path}`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Connecting-Coders",
        "X-GitHub-Api-Version": "2026-03-10",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const headers = new Headers(responseHeaders);
    for (const key of [
      "link",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
      "retry-after",
    ])
      if (upstream.headers.has(key))
        headers.set(key, upstream.headers.get(key)!);
    if (!upstream.ok)
      return Response.json(
        {
          message:
            upstream.status === 401
              ? "The server's GitHub credential needs reconnecting."
              : "GitHub could not complete this request.",
        },
        { status: upstream.status, headers },
      );
    const data: unknown = await upstream.json();
    if (session) {
      const { core } = quota.parse(data).resources;
      return Response.json(
        { authenticated: Boolean(token), ...core },
        { headers },
      );
    }
    return Response.json(
      parts.length === 3
        ? z.array(publicUser).parse(data)
        : publicUser.parse(data),
      { headers },
    );
  } catch {
    // Never return upstream exceptions, request headers, or credential details.
    return failure("GitHub could not be reached. Try again shortly.", 502);
  }
}
