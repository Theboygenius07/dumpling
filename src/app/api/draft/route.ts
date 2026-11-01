import { contextFor, draftReply, draftTicket } from "@/lib/ai";
import { change, read, wsOf } from "@/lib/store";
import type { Store, TicketDraft } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Drafts only. Nothing here is sent or created; the review screen shows the
// draft for a person to edit and approve.

function ticketInput(s: Store, ids: string[]) {
  return ids
    .map((id) => {
      const f = s.feedback.find((x) => x.id === id)!;
      const c = contextFor(f, s.testers, s.scripts);
      const answers = f.messages.filter((m) => m.from === "tester").map((m) => m.text).join(" · ");
      return [
        `Report ${f.id} from ${c.tester?.name} (${c.tester?.env.browser}, ${c.tester?.env.os}, ${c.tester?.env.device})`,
        c.script ? `Script "${c.script.title}", steps so far:\n${c.script.steps.filter((x) => !c.step || x.n <= c.step.n).map((x) => `  ${x.n}. ${x.action} (expected: ${x.expected})`).join("\n")}` : "",
        `Marked: ${f.verdict}. Wrote: """${f.text}"""`,
        answers ? `Follow-up answers: ${answers}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function ruleTicket(s: Store, ids: string[]): TicketDraft & { credits: Record<string, string> } {
  const fs = ids.map((id) => s.feedback.find((x) => x.id === id)!);
  const f = fs[0]!;
  const c = contextFor(f, s.testers, s.scripts);
  const envs = [...new Set(fs.map((x) => s.testers.find((t) => t.id === x.testerId)?.env.browser).filter(Boolean))];
  return {
    title: (f.analysis?.summary ?? f.text).slice(0, 70),
    severity: f.analysis?.severity ?? "major",
    severityWhy: f.analysis?.severityWhy ?? "",
    steps: c.script ? c.script.steps.filter((x) => !c.step || x.n <= c.step.n).map((x) => x.action) : [],
    expected: c.step?.expected ?? "",
    actual: fs.map((x) => x.analysis?.actual || x.text).join(" "),
    notes: `Seen on: ${envs.join(", ")}.`,
    credits: Object.fromEntries(fs.map((x) => [x.id, x.analysis?.facts[0] ?? ""])),
  };
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { groupId?: string; feedbackId?: string; purpose?: string; fresh?: boolean; reason?: string } | null;
  if (!b) return Response.json({ message: "Nothing to draft." }, { status: 400 });

  const ws = await wsOf(req);
  if (b.groupId) {
    const out = await change(ws, async (s) => {
      const g = s.groups.find((x) => x.id === b.groupId);
      if (!g) throw new Error("No such group");
      if (g.draft && !b.fresh) return g.draft;
      const ai = await draftTicket(ticketInput(s, g.memberIds));
      g.draft = ai ? { ...ai, by: "model" } : { ...ruleTicket(s, g.memberIds), by: "rules" };
      return g.draft;
    });
    return Response.json(out);
  }

  if (b.feedbackId && b.purpose) {
    const s = await read(ws);
    const f = s?.feedback.find((x) => x.id === b.feedbackId);
    if (!s || !f) return Response.json({ message: "That note isn’t here any more." }, { status: 404 });
    const g = s.groups.find((x) => x.id === f.groupId);
    const c = contextFor(f, s.testers, s.scripts);
    const input = [
      `Tester: ${c.tester?.name}. Step: ${c.step ? `${c.step.action} (expected: ${c.step.expected})` : "free feedback"}.`,
      `They wrote: """${f.text}"""`,
      f.analysis?.missing.length ? `What a developer still needs: ${f.analysis.missing.join("; ")}` : "",
      b.purpose === "idea" && g ? `Ideas backlog theme: "${g.title}". ${g.memberIds.length > 1 ? `Exactly ${g.memberIds.length - 1} OTHER tester${g.memberIds.length > 2 ? "s" : ""} asked for something similar.` : "No one else has asked for this yet."} The same message goes to everyone who asked, so don't describe their idea in detail.` : "",
      b.reason ? `Facts to use: ${b.reason}` : "",
      "Do not start with a greeting or their name — that is added for you.",
    ]
      .filter(Boolean)
      .join("\n");
    const out = await draftReply(b.purpose, input);
    const fallback: Record<string, string> = {
      ask: f.analysis?.question || "thanks for flagging this. What did you see on screen when it went wrong?",
      idea: `thank you — this is a feature idea rather than a bug, so it’s gone into the ideas backlog${g && g.memberIds.length > 1 ? ` with ${g.memberIds.length - 1} others who asked for the same` : ""}. The product team reads it before planning.`,
      "not-a-bug": "thanks for noticing this. It works this way on purpose — we’ll make that clearer.",
      answer: "good question — here’s how it works.",
      thank: "thank you — that’s lovely to hear, and it’s been passed to the team who built it.",
    };
    return Response.json(out ?? { text: fallback[b.purpose] ?? "", options: b.purpose === "ask" ? f.analysis?.options ?? [] : [] });
  }
  return Response.json({ message: "Nothing to draft." }, { status: 400 });
}
