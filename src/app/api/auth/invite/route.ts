import { inviteByToken } from "@/lib/auth";
import { workspaceRefs } from "@/lib/store";

export const dynamic = "force-dynamic";

/** What an invitation link is for, so the sign-up page can say so (and fill in the email). */
export async function GET(req: Request) {
  const inv = await inviteByToken(new URL(req.url).searchParams.get("token") ?? "");
  if (!inv) return Response.json({ message: "That invitation has been used or withdrawn." }, { status: 404 });
  const [ws] = await workspaceRefs([inv.ws]);
  return Response.json({ email: inv.email, role: inv.role, workspace: ws?.name ?? "a workspace" });
}
