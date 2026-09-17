import { getChatGPTUser } from "@/app/chatgpt-auth";
import { githubAuth } from "@/lib/github/auth/runtime";
import { privateHeaders } from "@/lib/github/auth/service";
import { proxyGitHub } from "@/lib/github/proxy";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = githubAuth();
    const viewer = await getChatGPTUser();
    const base = {
      configured: Boolean(auth),
      authenticated: false,
      needsSiteSignIn: !viewer,
    };
    if (!viewer || !auth)
      return Response.json(base, { headers: privateHeaders });
    const session = await auth.credential(request, viewer.userId);
    if (!session) return Response.json(base, { headers: privateHeaders });
    const quotaResponse = await proxyGitHub(request, session.token);
    if (quotaResponse.status === 401) {
      await auth.forget(request, viewer.userId);
      return Response.json(
        { ...base, expired: true },
        { headers: privateHeaders },
      );
    }
    const data: unknown = quotaResponse.ok ? await quotaResponse.json() : {};
    const quota = typeof data === "object" && data !== null ? data : {};
    return Response.json(
      {
        ...quota,
        ...base,
        authenticated: true,
        login: session.login,
        expires: session.expires,
      },
      { headers: privateHeaders },
    );
  } catch {
    return Response.json(
      { message: "GitHub session unavailable. Try again shortly." },
      { status: 503, headers: privateHeaders },
    );
  }
}
