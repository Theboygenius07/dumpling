import { analyze, contextFor, cosine, embed, overlap } from "@/lib/ai";
import { access, testerFor } from "@/lib/access";
import { envFrom } from "@/lib/sources";
import { read } from "@/lib/store";
import { alike } from "@/lib/triage";
import type { Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";

// Runs while the tester types: what Dumpling understood, whether it is thin, and
// whether someone already reported it. It never changes anything.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { testerId?: string; scriptId?: string | null; stepId?: string | null; verdict?: Verdict; text?: string } | null;
  const a = await access(req, "test");
  if (a instanceof Response) return a;
  const s = await read(a.ws);
  const text = b?.text?.trim() ?? "";
  if (!s || !b || text.split(/\s+/).length < 2) return Response.json({ analysis: null, similar: [] });
  const me = testerFor(s, a, req, b.testerId, false);
  const ctx = contextFor({ testerId: me ?? "", scriptId: b.scriptId ?? null, stepId: b.stepId ?? null }, s.testers, s.scripts);
  // Someone testing for the first time has no tester record yet: their browser still says what they’re on.
  ctx.tester ??= { id: "", name: a.user.name, env: envFrom(req.headers.get("user-agent") ?? "") };
  const verdict = b.verdict ?? "off";
  const [analysis, vecs] = await Promise.all([
    analyze({ verdict, text }, ctx),
    embed([[ctx.step ? `${ctx.script?.title} step ${ctx.step.n}: ${ctx.step.action}` : "", text].filter(Boolean).join("\n")]),
  ]);
  const v = vecs?.[0];
  const fam = (k?: string) => (k === "bug" || k === "unclear" ? "bug" : k === "idea" ? "idea" : null);
  const mine = fam(analysis.kind) ?? (verdict === "idea" ? "idea" : "bug");
  const similar = s.feedback
    .filter((f) => fam(f.analysis?.kind) === mine && f.testerId !== me)
    .map((f) => {
      const t = v && f.embedding ? alike(cosine(v, f.embedding)) : overlap(text, f.text);
      const sameStep = !!b.stepId && f.stepId === b.stepId;
      const score = 0.7 * t + (sameStep ? 0.3 : f.scriptId && f.scriptId === b.scriptId ? 0.1 : 0);
      const g = s.groups.find((x) => x.id === f.groupId);
      return { f, score, sameStep, g };
    })
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    // One card per group: the reader is asked about a problem, not a person.
    .filter((x, i, all) => !x.g || all.findIndex((y) => y.g?.id === x.g?.id) === i)
    .slice(0, 2)
    .map(({ f, score, sameStep, g }) => ({
      id: f.id,
      summary: g && g.memberIds.length > 1 ? g.title : (f.analysis?.summary ?? f.text),
      count: g?.memberIds.length ?? 1,
      ticketId: g?.ticketId ?? null,
      score: Math.round(score * 100) / 100,
      sameStep,
    }));
  return Response.json({ analysis, similar });
}
