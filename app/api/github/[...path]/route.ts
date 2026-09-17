import { getChatGPTUser } from "@/app/chatgpt-auth";
import { proxyGitHub } from "@/lib/github/proxy";
import { githubAuth } from "@/lib/github/auth/runtime";
import { privateHeaders } from "@/lib/github/auth/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const viewer = await getChatGPTUser();
    const auth = githubAuth();
    const credential =
      viewer && auth ? await auth.credential(request, viewer.userId) : null;
    if (!credential)
      return Response.json(
        { message: "Connect your GitHub account to explore." },
        { status: 401, headers: privateHeaders },
      );
    const response = await proxyGitHub(request, credential.token);
    if (response.status === 401) await auth!.forget(request, viewer!.userId);
    return response;
  } catch {
    return Response.json(
      {
        message: "GitHub access is temporarily unavailable. Try again shortly.",
      },
      { status: 503, headers: privateHeaders },
    );
  }
}
