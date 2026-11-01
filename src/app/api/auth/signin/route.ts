import { acceptInvitesFor, createSession, publicUser, sessionCookie, signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const user = await signIn(b?.email ?? "", b?.password ?? "");
  // One answer for a wrong email and a wrong password, so neither can be probed.
  if (!user) return Response.json({ message: "That email and password don’t match." }, { status: 401 });
  await acceptInvitesFor(user);
  const token = await createSession(user.id);
  return Response.json({ ok: true, user: publicUser(user) }, { headers: { "set-cookie": sessionCookie(token, req) } });
}
