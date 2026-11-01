import { addMember, roleOf, userFrom } from "@/lib/auth";
import { demoStore } from "@/lib/demo";
import { DEMO_WS, WS_COOKIE, cookieOf, isDemo, replace, wsCookie } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Open (or reset) a demo: the one this browser is in if it's a demo you manage, else the shared chalk demo. */
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ message: "Sign in first." }, { status: 401 });
  const here = cookieOf(req, WS_COOKIE);
  const target = here && isDemo(here) && (await roleOf(user.id, here)) === "manager" ? here : DEMO_WS;
  const role = await roleOf(user.id, target);
  // Resetting a demo is a manager's call; opening the shared one the first time makes you its manager.
  if (role && role !== "manager") return Response.json({ message: "Only a manager can reset the demo." }, { status: 403 });
  const s = await demoStore({ fresh: new URL(req.url).searchParams.get("fresh") === "1", sharedKey: target === DEMO_WS });
  await replace(target, s);
  if (!role) await addMember(target, user.id, "manager");
  return Response.json({ ok: true, feedback: s.feedback.length, groups: s.groups.length }, { headers: { "set-cookie": wsCookie(target) } });
}
