import { access, testerFor } from "@/lib/access";
import { change, now, uid } from "@/lib/store";
import { ack, triage } from "@/lib/triage";
import type { Feedback, Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = { testerId?: string; scriptId?: string | null; stepId?: string | null; verdict?: Verdict; text?: string; sameAs?: string | null; notSame?: string[]; asked?: string; answer?: string };

export async function POST(req: Request) {
  const b = ((await req.json().catch(() => null)) as Body | null) ?? {};
  const text = b.text?.trim() ?? "";
  if (text.length < 2) return Response.json({ message: "Say what happened, in a few words." }, { status: 400 });
  const a = await access(req, "test");
  if (a instanceof Response) return a;
  const verdict: Verdict = (["worked", "failed", "off", "idea"] as const).includes(b.verdict as Verdict) ? (b.verdict as Verdict) : "off";
  const f = await change(a.ws, async (s) => {
    const testerId = testerFor(s, a, req, b.testerId)!;
    const f: Feedback = {
      id: uid("f"),
      testerId,
      scriptId: b.scriptId ?? null,
      stepId: b.stepId ?? null,
      verdict,
      text,
      at: now(),
      source: "tester",
      sameAs: b.sameAs && s.feedback.some((x) => x.id === b.sameAs) ? b.sameAs : null,
      notSame: Array.isArray(b.notSame) ? b.notSame.filter((id) => typeof id === "string").slice(0, 5) : [],
      analysis: null,
      status: "new",
      groupId: null,
      ticketId: null,
      messages: [],
    };
    // A question Dumpling asked while they typed, and their answer, travel with the note.
    if (b.asked && b.answer) {
      f.messages.push({ id: uid("m"), at: now(), from: "dumpling", text: b.asked, question: true, answered: true });
      f.messages.push({ id: uid("m"), at: now(), from: "tester", text: b.answer });
    }
    s.feedback.push(f);
    await triage(s, f);
    ack(s, f);
    return f;
  });
  const { embedding: _e, ...out } = f;
  return Response.json(out);
}
