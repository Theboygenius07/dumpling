import { promises as fs } from "node:fs";
import { ensureSources } from "@/lib/sources";
import { access } from "@/lib/access";
import { change, uid } from "@/lib/store";
import { ack, triage } from "@/lib/triage";
import type { Feedback } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// chalk's own "Report a problem" (src/app/api/support) writes one JSON line per
// report to .data/support.jsonl on a Mac without accounts. Dumpling reads that log
// so reports from real use land in the same review queue as scripted testing.
const FIELD = "t_field";

export async function POST(req: Request) {
  const a = await access(req, "manage");
  if (a instanceof Response) return a;
  const file = process.env.CHALK_REPORTS;
  if (!file) return Response.json({ message: "Set CHALK_REPORTS to chalk’s support.jsonl." }, { status: 400 });
  let lines: { at: string; topic: string; message: string; page?: string | null; platform?: string }[] = [];
  try {
    lines = (await fs.readFile(file, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return Response.json({ imported: 0, message: "No reports from chalk yet — use Report a problem in chalk’s rail, then import." });
  }
  const imported = await change(a.ws, async (s) => {
    if (!s.testers.some((t) => t.id === FIELD)) s.testers.push({ id: FIELD, name: "chalk user (Report a problem)", env: { browser: "chalk app", os: "—", device: "—" } });
    const have = new Set(s.feedback.filter((f) => f.source === "chalk-report").map((f) => `${f.at}|${f.text}`));
    let n = 0;
    for (const l of lines) {
      const at = new Date(l.at).toISOString();
      const text = l.page ? `${l.message} (on ${l.page})` : l.message;
      if (have.has(`${at}|${text}`)) continue;
      const f: Feedback = { id: uid("f"), testerId: FIELD, scriptId: null, stepId: null, verdict: l.topic === "idea" ? "idea" : "failed", text, at, source: "chalk-report", sameAs: null, analysis: null, status: "new", groupId: null, ticketId: null, messages: [] };
      s.feedback.push(f);
      await triage(s, f);
      ack(s, f);
      n++;
    }
    const src = ensureSources(s).find((x) => x.kind === "chalk");
    if (src && n) { src.count += n; src.lastAt = new Date().toISOString(); }
    return n;
  });
  return Response.json({ imported });
}
