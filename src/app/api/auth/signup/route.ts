import { AuthError, createSession, publicUser, sessionCookie, signUp } from "@/lib/auth";
import { db } from "@/lib/docs";

export const dynamic = "force-dynamic";

/** Open sign-up locally; DUMPLING_SIGNUP=invite limits it to people who were invited (and the very first account). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { email?: string; name?: string; password?: string } | null;
  try {
    if (process.env.DUMPLING_SIGNUP === "invite" && (await db().list("users")).length > 0) {
      const invited = (await db().list<{ email: string }>("invites")).some((x) => x.data.email === (b?.email ?? "").trim().toLowerCase());
      if (!invited) throw new AuthError("Sign-up is by invitation — ask a workspace manager to invite you.");
    }
    const user = await signUp(b?.email ?? "", b?.name ?? "", b?.password ?? "");
    const token = await createSession(user.id);
    return Response.json({ ok: true, user: publicUser(user) }, { headers: { "set-cookie": sessionCookie(token, req) } });
  } catch (e) {
    return Response.json({ message: e instanceof AuthError ? e.message : "That didn’t work — try again." }, { status: 400 });
  }
}
