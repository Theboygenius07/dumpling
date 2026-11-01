import { promises as fs } from "node:fs";
import path from "node:path";
import { seed } from "@/lib/seed";
import { ensureSources } from "@/lib/sources";
import { replace } from "@/lib/store";
import { triageAll } from "@/lib/triage";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The first reset reads all 21 seed notes with the model (about half a
// minute); later resets reuse that reading so a demo can restart instantly.
const CACHE = path.join(process.cwd(), "data", "seed-cache.json");

export async function POST(req: Request) {
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
    await triageAll(s);
    await fs.mkdir(path.dirname(CACHE), { recursive: true });
    await fs.writeFile(CACHE, JSON.stringify(s));
  }
  s.sources = undefined;
  ensureSources(s);
  await replace(s);
  return Response.json({ ok: true, feedback: s.feedback.length, groups: s.groups.length });
}
