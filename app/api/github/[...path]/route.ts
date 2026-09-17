import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { proxyGitHub } from "@/lib/github/proxy";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await getChatGPTUser()))
    return Response.json(
      { message: "Sign in to this site to explore." },
      { status: 401 },
    );
  return proxyGitHub(request, env.GITHUB_TOKEN);
}
