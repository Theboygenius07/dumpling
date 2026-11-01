import { promises as fs } from "node:fs";
import path from "node:path";
import { seed } from "@/lib/seed";
import { setProduct } from "@/lib/ai";
import { ensureSources } from "@/lib/sources";
import { addMember, roleOf, userFrom } from "@/lib/auth";
import { DEMO_WS, replace, wsCookie } from "@/lib/store";
import { triageAll } from "@/lib/triage";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The first reset reads all 21 seed notes with the model (about half a
// minute); later resets reuse that reading so a demo can restart instantly.
const CACHE = path.join(process.cwd(), "data", "seed-cache.json");

export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ message: "Sign in first." }, { status: 401 });
  // Resetting the demo is a manager's call; opening it for the first time makes you its manager.
  const role = await roleOf(user.id, DEMO_WS);
  if (role && role !== "manager") return Response.json({ message: "Only a manager can reset the demo." }, { status: 403 });
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  let s: Store | null = null;
  if (!fresh) {
    try {
      s = JSON.parse(await fs.readFile(CACHE, "utf8")) as Store;
    } catch {}
  }
  if (s) {
    // Shift every timestamp so the cycle looks like it is happening now.
    const shift = Date.now() - new Date(s.feedback.reduce((m, f) => (f.at > m ? f.at : m), s.feedback[0]!.at)).getTime() - 60 * 60_000;
    const move = (t: string) => new Date(new Date(t).getTime() + shift).toISOString();
    s.feedback.forEach((f) => {
      f.at = move(f.at);
      f.messages.forEach((m) => (m.at = move(m.at)));
    });
    s.cycle.startedAt = move(s.cycle.startedAt);
    s.cycle.endsAt = move(s.cycle.endsAt);
  } else {
    s = seed();
    setProduct(s.cycle);
    await triageAll(s);
    await fs.mkdir(path.dirname(CACHE), { recursive: true });
    await fs.writeFile(CACHE, JSON.stringify(s));
  }
  s.cycle.productAbout ??= "an AI teaching whiteboard";
  s.cycle.ticketPrefix ??= "CH";
  s.sources = undefined;
  ensureSources(s, true);
  await replace(DEMO_WS, s);
  if (!role) await addMember(DEMO_WS, user.id, "manager");
  // Loading the demo also opens it in this browser.
  return Response.json({ ok: true, feedback: s.feedback.length, groups: s.groups.length }, { headers: { "set-cookie": wsCookie(DEMO_WS) } });
}
