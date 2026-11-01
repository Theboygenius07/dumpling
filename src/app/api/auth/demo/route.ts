import { randomBytes } from "node:crypto";
import { addMember, createSession, guestUser, sessionCookie } from "@/lib/auth";
import { demoStore } from "@/lib/demo";
import { replace, wsCookie } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Try the chalk demo" — no account needed. Each visitor gets a guest session
 * and a private copy of the demo, so people exploring at the same time never
 * trip over each other's decisions.
 */
export async function POST(req: Request) {
  const user = await guestUser();
  const ws = `ws_demo_${randomBytes(5).toString("hex")}`;
  await replace(ws, await demoStore());
  await addMember(ws, user.id, "manager");
  const token = await createSession(user.id, 1);
  const headers = new Headers();
  headers.append("set-cookie", sessionCookie(token, req, 1));
  headers.append("set-cookie", wsCookie(ws));
  return Response.json({ ok: true }, { headers });
}
