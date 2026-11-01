import { promises as fs } from "node:fs";
import path from "node:path";
import { setProduct } from "./ai";
import { seed } from "./seed";
import { ensureSources } from "./sources";
import { triageAll } from "./triage";
import type { Store } from "./types";

// The chalk demo: 21 notes from six testers, already read and grouped. The
// model reads them once (about half a minute); every demo after that is a
// copy of that reading, with its clock moved to now.
const CACHE = path.join(process.cwd(), "data", "seed-cache.json");

export async function demoStore(opts: { fresh?: boolean; sharedKey?: boolean } = {}): Promise<Store> {
  let s: Store | null = null;
  if (!opts.fresh) {
    try { s = JSON.parse(await fs.readFile(CACHE, "utf8")) as Store; } catch {}
  }
  if (s) {
    const shift = Date.now() - new Date(s.feedback.reduce((m, f) => (f.at > m ? f.at : m), s.feedback[0]!.at)).getTime() - 60 * 60_000;
    const move = (t: string) => new Date(new Date(t).getTime() + shift).toISOString();
    s.feedback.forEach((f) => { f.at = move(f.at); f.messages.forEach((m) => (m.at = move(m.at))); });
    s.cycle.startedAt = move(s.cycle.startedAt);
    s.cycle.endsAt = move(s.cycle.endsAt);
  } else {
    s = seed();
    setProduct(s.cycle);
    await triageAll(s);
    await fs.mkdir(path.dirname(CACHE), { recursive: true }).catch(() => {});
    await fs.writeFile(CACHE, JSON.stringify(s)).catch(() => {});
  }
  s.cycle.productAbout ??= "an AI teaching whiteboard";
  s.cycle.ticketPrefix ??= "CH";
  s.sources = undefined;
  // The shared demo keeps the documented key; a visitor's private copy gets its own.
  ensureSources(s, !!opts.sharedKey);
  return s;
}
