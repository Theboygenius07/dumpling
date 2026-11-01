import { access, viewFor } from "@/lib/access";
import { workspacesOf } from "@/lib/auth";
import { hasModel } from "@/lib/ai";
import { read, workspaceRefs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await access(req, "view");
  if (a instanceof Response) {
    // Signed in but with no workspace yet: the app shows its welcome.
    const body = await a.clone().json().catch(() => ({}));
    if (body.noWorkspace) return Response.json({ empty: true, me: body.me, model: hasModel(), workspaces: [] });
    return a;
  }
  const s = await read(a.ws);
  const workspaces = await workspaceRefs(await workspacesOf(a.user.id));
  if (!s) return Response.json({ empty: true, model: hasModel(), workspaces });
  return Response.json({ ...viewFor(s, a), model: hasModel(), workspace: a.ws, workspaces });
}
