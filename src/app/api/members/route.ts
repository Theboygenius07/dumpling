import { access } from "@/lib/access";
import { AuthError, ROLES, addMember, invite, invitesOf, membersOf, removeMember, revokeInvite, usersById, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await access(req, "manage");
  if (a instanceof Response) return a;
  const members = await membersOf(a.ws);
  const users = await usersById(members.map((m) => m.userId));
  return Response.json({
    members: members.map((m) => ({ ...users.find((u) => u.id === m.userId), role: m.role, you: m.userId === a.user.id })),
    invites: (await invitesOf(a.ws)).map((i) => ({ token: i.token, email: i.email, role: i.role, createdAt: i.createdAt })),
  });
}

type Body = { action?: "invite" | "role" | "remove" | "revoke"; email?: string; role?: Role; userId?: string; token?: string };

export async function POST(req: Request) {
  const a = await access(req, "manage");
  if (a instanceof Response) return a;
  const b = (await req.json().catch(() => null)) as Body | null;
  try {
    if (b?.role && !ROLES.includes(b.role)) throw new AuthError("That isn’t a role.");
    if (b?.action === "invite") return Response.json({ ok: true, ...(await invite(a.ws, b.email ?? "", b.role ?? "tester")) });
    if (b?.action === "role") {
      if (b.userId === a.user.id && b.role !== "manager") throw new AuthError("Ask another manager to change your own role.");
      if (!(await membersOf(a.ws)).some((m) => m.userId === b.userId)) throw new AuthError("They’re not in this workspace.");
      await addMember(a.ws, b.userId!, b.role!);
      return Response.json({ ok: true });
    }
    if (b?.action === "remove") {
      if (b.userId === a.user.id) throw new AuthError("You can’t remove yourself — ask another manager.");
      await removeMember(a.ws, b.userId ?? "");
      return Response.json({ ok: true });
    }
    if (b?.action === "revoke") {
      await revokeInvite(a.ws, b.token ?? "");
      return Response.json({ ok: true });
    }
    throw new AuthError("Nothing to do.");
  } catch (e) {
    return Response.json({ message: e instanceof AuthError ? e.message : "That didn’t work — try again." }, { status: 400 });
  }
}
