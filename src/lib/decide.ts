import { now, uid } from "./store";
import { leave, linksOf, pairKey, place, relink, retitleIdea, stamp, triage } from "./triage";
import type { Feedback, Kind, Severity, Store, TicketDraft } from "./types";

// Every action takes exactly one target. There is no list form of any of
// them, and nothing here runs unless a person pressed something: that is the
// "no batch approve, no auto-creation" rule, enforced where it can't be skipped.

export type Action =
  | { action: "create-ticket"; groupId: string; draft: TicketDraft }
  | { action: "add-witness"; feedbackId: string }
  | { action: "split"; feedbackId: string }
  | { action: "join"; feedbackId: string; groupId: string }
  | { action: "file-idea"; groupId: string; text: string }
  | { action: "set-kind"; feedbackId: string; kind: Kind }
  | { action: "ask"; feedbackId: string; text: string; options: string[] }
  | { action: "answer"; feedbackId: string; text: string }
  | { action: "thank"; feedbackId: string; text: string };

export class Refused extends Error {}

const first = (s: Store, f: Feedback) => s.testers.find((t) => t.id === f.testerId)?.name.split(" ")[0] ?? "there";
const fb = (s: Store, id: unknown) => {
  const f = typeof id === "string" ? s.feedback.find((x) => x.id === id) : undefined;
  if (!f) throw new Refused("That note isn’t here any more.");
  return f;
};
const say = (f: Feedback, text: string, from: "manager" | "heard" = "manager", extra: Partial<Feedback["messages"][number]> = {}) =>
  f.messages.push({ id: uid("m"), at: now(), from, text, ...extra });

export async function decide(s: Store, a: Action): Promise<string> {
  switch (a.action) {
    case "create-ticket": {
      const g = s.groups.find((x) => x.id === a.groupId);
      if (!g || g.status !== "open") throw new Refused("This group has already been decided.");
      const d = a.draft;
      if (!d?.title?.trim()) throw new Refused("A ticket needs a title.");
      const id = `CH-${s.nextTicket++}`;
      const ai = g.draft;
      const edited = ai ? (["title", "severity", "expected", "actual", "notes"] as const).filter((k) => String(ai[k]).trim() !== String(d[k]).trim()) : [];
      if (ai && ai.steps.join("\n") !== d.steps.join("\n")) edited.push("steps" as never);
      s.tickets.push({
        id,
        groupId: g.id,
        witnessIds: [...g.memberIds],
        title: d.title.trim(),
        severity: d.severity,
        severityWhy: d.severityWhy,
        steps: d.steps.filter((x) => x.trim()),
        expected: d.expected,
        actual: d.actual,
        notes: d.notes,
        createdAt: now(),
        approvedBy: s.manager,
        draftedBy: ai?.by ?? "rules",
        edited: edited as string[],
        status: "open",
      });
      g.status = "ticketed";
      g.ticketId = id;
      g.title = d.title.trim();
      const n = g.memberIds.length;
      for (const mid of g.memberIds) {
        const f = fb(s, mid);
        f.status = "ticketed";
        f.ticketId = id;
        const credit = ai?.credits?.[f.id];
        const others = n > 1 ? ` ${n - 1} other ${n - 1 === 1 ? "tester" : "testers"} saw it too, so it’s been easier to pin down.` : "";
        const detail = credit ? ` Your detail — “${credit}” — is in the ticket.` : "";
        say(f, `Hi ${first(s, f)} — your note is now ticket ${id}, “${d.title.trim()}”.${others}${detail}`);
      }
      stamp(s, {
        action: "create-ticket",
        target: g.id,
        aiSaid: ai ? `${ai.severity} · “${ai.title}”` : "no draft",
        humanSaid: `${d.severity} · “${d.title.trim()}”${edited.length ? ` (edited ${edited.join(", ")})` : ""}`,
        overruled: !!ai && ai.severity !== d.severity,
      });
      return id;
    }

    case "add-witness": {
      const f = fb(s, a.feedbackId);
      const g = s.groups.find((x) => x.id === f.groupId);
      const t = s.tickets.find((x) => x.id === g?.ticketId);
      if (!g || !t) throw new Refused("There’s no ticket to add this to.");
      if (!t.witnessIds.includes(f.id)) t.witnessIds.push(f.id);
      f.status = "ticketed";
      f.ticketId = t.id;
      say(f, `Hi ${first(s, f)} — this one is already known: it’s ticket ${t.id}, “${t.title}”. We’ve added your note to it, so the team knows it happened to you too (${t.witnessIds.length} people so far).`);
      stamp(s, { action: "join", target: f.id, aiSaid: `same as ${t.id}`, humanSaid: `added to ${t.id}`, overruled: false });
      return t.id;
    }

    case "split": {
      const f = fb(s, a.feedbackId);
      const g = s.groups.find((x) => x.id === f.groupId);
      if (!g || g.memberIds.length < 2) throw new Refused("It’s already on its own.");
      if (f.status === "ticketed") throw new Refused("That’s already part of a ticket.");
      for (const l of linksOf(s, f.id)) if (g.memberIds.includes(l.a === f.id ? l.b : l.a)) l.human = "different";
      leave(s, f);
      s.groups.push({ id: uid("g"), title: f.analysis?.summary ?? f.text, memberIds: [f.id], status: "open", createdBy: "manager", ticketId: null, draft: null });
      f.groupId = s.groups[s.groups.length - 1]!.id;
      stamp(s, { action: "split", target: f.id, aiSaid: `same as “${g.title}”`, humanSaid: "a different problem", overruled: true });
      return f.groupId;
    }

    case "join": {
      const f = fb(s, a.feedbackId);
      const g = s.groups.find((x) => x.id === a.groupId);
      if (!g || g.status === "closed") throw new Refused("That group isn’t open.");
      if (f.groupId === g.id) return g.id;
      const links = linksOf(s, f.id).filter((l) => g.memberIds.includes(l.a === f.id ? l.b : l.a));
      const aiAgreed = links.some((l) => l.verdict === "same");
      for (const l of links) l.human = "same";
      if (links.length === 0 && g.memberIds[0]) {
        const [x, y] = pairKey(f.id, g.memberIds[0]);
        s.links.push({ a: x, b: y, score: 0, textScore: 0, sameStep: false, testerSaid: false, verdict: "different", same: [], differ: [], by: "rules", human: "same" });
      }
      leave(s, f);
      g.memberIds.push(f.id);
      g.draft = null;
      f.groupId = g.id;
      if (g.status === "idea") await retitleIdea(s, g);
      stamp(s, { action: "join", target: f.id, aiSaid: aiAgreed ? "same" : "not sure / different", humanSaid: `same as “${g.title}”`, overruled: !aiAgreed });
      return g.id;
    }

    case "file-idea": {
      const g = s.groups.find((x) => x.id === a.groupId);
      if (!g || g.status !== "open") throw new Refused("This group has already been decided.");
      const wasBug = g.memberIds.some((id) => s.feedback.find((f) => f.id === id)?.analysis?.kind === "bug");
      g.status = "idea";
      for (const mid of g.memberIds) {
        const f = fb(s, mid);
        f.status = "idea";
        say(f, `Hi ${first(s, f)} — ${a.text.trim()}`);
      }
      if (g.memberIds.length > 1) await retitleIdea(s, g);
      stamp(s, { action: "file-idea", target: g.id, aiSaid: wasBug ? "bug" : "idea", humanSaid: "idea", overruled: wasBug });
      return g.id;
    }

    case "set-kind": {
      const f = fb(s, a.feedbackId);
      if (!f.analysis) throw new Refused("Still reading this one.");
      if (!(["bug", "idea", "question", "praise"] as Kind[]).includes(a.kind)) throw new Refused("That isn’t a kind of feedback.");
      const was = f.analysis.kind;
      if (was === a.kind) return f.groupId ?? f.id;
      f.analysis.kind = a.kind;
      f.analysis.kindWhy = `${s.manager.split(" ")[0]} changed this to “${a.kind}” — Heard had read it as “${was}”.`;
      await relink(s, f);
      await place(s, f);
      stamp(s, { action: "set-kind", target: f.id, aiSaid: was, humanSaid: a.kind, overruled: true });
      return f.groupId ?? f.id;
    }

    case "ask": {
      const f = fb(s, a.feedbackId);
      if (!a.text?.trim()) throw new Refused("Write the question first.");
      say(f, a.text.trim(), "manager", { question: true, options: (a.options ?? []).filter(Boolean).slice(0, 4) });
      f.status = "asked";
      stamp(s, { action: "ask", target: f.id, aiSaid: f.analysis?.evidence ?? "", humanSaid: "asked the tester", overruled: false });
      return f.id;
    }

    case "answer":
    case "thank": {
      const f = fb(s, a.feedbackId);
      if (!a.text?.trim()) throw new Refused("Write the reply first.");
      say(f, `Hi ${first(s, f)} — ${a.text.trim()}`);
      f.status = a.action === "thank" ? "thanked" : "answered";
      if (f.groupId) {
        const g = s.groups.find((x) => x.id === f.groupId);
        if (g && g.memberIds.length === 1 && g.status === "open") g.status = "closed";
      }
      stamp(s, { action: a.action, target: f.id, aiSaid: f.analysis?.kind ?? "", humanSaid: a.action === "thank" ? "thanked" : "answered", overruled: false });
      return f.id;
    }
  }
}

/** A tester answers a question: read the note again with what they added. */
export async function testerReplies(s: Store, feedbackId: string, text: string) {
  const f = fb(s, feedbackId);
  if (!text.trim()) throw new Refused("Say a few words first.");
  for (const m of f.messages) if (m.question) m.answered = true;
  f.messages.push({ id: uid("m"), at: now(), from: "tester", text: text.trim() });
  const before = f.groupId ? s.groups.find((g) => g.id === f.groupId)?.memberIds.length ?? 1 : 1;
  f.status = "new";
  await triage(s, f);
  const g = s.groups.find((x) => x.id === f.groupId);
  const n = g?.memberIds.length ?? 1;
  const matched = n > before || (n > 1 && before === 1) ? ` It looks like what ${n - 1} other ${n - 1 === 1 ? "tester" : "testers"} saw, so your note now backs theirs up.` : "";
  say(f, `Thanks — that’s exactly what helps.${matched} A person will look at it again.`, "heard");
  return f.id;
}

export const severities: Severity[] = ["blocker", "major", "minor", "cosmetic"];
