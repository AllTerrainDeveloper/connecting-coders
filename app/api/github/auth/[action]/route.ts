import { browserIdentity, startBrowserLogin } from "@/lib/github/auth/browser";
import { githubAuth } from "@/lib/github/auth/runtime";
import { privateHeaders } from "@/lib/github/auth/service";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const viewer = await browserIdentity(request);
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
      return await startBrowserLogin(auth, request);
    if (!viewer)
      return Response.json(
        { message: "Connect GitHub to continue." },
        { status: 401, headers: privateHeaders },
      );
    if (action === "callback" && request.method === "GET")
      return await auth.callback(request, viewer);
    if (action === "logout" && request.method === "POST")
      return await auth.logout(request, viewer);
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
