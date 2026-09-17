import { getChatGPTUser } from "@/app/chatgpt-auth";
import { githubAuth } from "@/lib/github/auth/runtime";
import { privateHeaders } from "@/lib/github/auth/service";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const viewer = await getChatGPTUser();
    if (!viewer)
      return Response.json(
        { message: "Sign in to this site first, then connect GitHub." },
        { status: 401, headers: privateHeaders },
      );
    const auth = githubAuth();
    if (!auth)
      return Response.json(
        {
          message:
            "GitHub sign-in has not been configured by the site owner yet.",
        },
        { status: 503, headers: privateHeaders },
      );
    const action = new URL(request.url).pathname.split("/").at(-1);
    if (action === "start" && request.method === "POST")
      return await auth.start(request, viewer.userId);
    if (action === "callback" && request.method === "GET")
      return await auth.callback(request, viewer.userId);
    if (action === "logout" && request.method === "POST")
      return await auth.logout(request, viewer.userId);
    return new Response(null, { status: 405, headers: privateHeaders });
  } catch {
    return Response.json(
      {
        message: "GitHub sign-in is temporarily unavailable. Please try again.",
      },
      { status: 503, headers: privateHeaders },
    );
  }
}
export const GET = handle;
export const POST = handle;
