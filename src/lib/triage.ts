import { analyze, compare, contextFor, cosine, embed, overlap, reportText, themeOf, type Context } from "./ai";
import { now, uid } from "./store";
import type { Feedback, Group, Kind, Link, Store } from "./types";

// Heard proposes; people decide. Nothing in this file creates a ticket, closes
// feedback or sends a tester anything but an acknowledgement.

const family = (k: Kind | undefined) => (k === "bug" || k === "unclear" ? "bug" : k === "idea" ? "idea" : null);

/** Grouped together with confidence: at or above SAME. Shown as "maybe — your call" between MAYBE and SAME. */
export const SAME = 0.68;
export const MAYBE = 0.45;

export function ctxOf(s: Store, f: Feedback): Context {
  return contextFor(f, s.testers, s.scripts);
}

export function answersOf(f: Feedback) {
  return f.messages
    .filter((m) => m.from === "tester")
    .map((m) => m.text)
    .join(" · ");
}

function embedText(s: Store, f: Feedback) {
  const c = ctxOf(s, f);
  return [c.step ? `${c.script?.title} step ${c.step.n}: ${c.step.action}` : "", f.analysis?.summary ?? "", f.text, answersOf(f)].filter(Boolean).join("\n");
}

function stepScore(s: Store, a: Feedback, b: Feedback) {
  if (!a.scriptId || a.scriptId !== b.scriptId) return 0;
  if (a.stepId === b.stepId) return 1;
  const sc = s.scripts.find((x) => x.id === a.scriptId);
  const na = sc?.steps.find((x) => x.id === a.stepId)?.n ?? 0;
  const nb = sc?.steps.find((x) => x.id === b.stepId)?.n ?? 0;
  return Math.abs(na - nb) <= 1 ? 0.6 : 0.3;
}

function textScore(a: Feedback, b: Feedback) {
  if (a.embedding && b.embedding) return alike(cosine(a.embedding, b.embedding));
  return overlap(a.text, b.text);
}

/** Embedding cosine to "how alike", 0..1. Unrelated notes in one product sit near 0.3; a reworded copy near 0.9. */
export const alike = (cos: number) => clamp((cos - 0.35) / 0.55);

export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Recompute every link from `f` to the earlier/other reports it could match. */
export async function relink(s: Store, f: Feedback, pool?: Feedback[]) {
  // A manager's call on a pair outlives any re-reading of it.
  const human = new Map(s.links.filter((l) => (l.a === f.id || l.b === f.id) && l.human).map((l) => [`${l.a}|${l.b}`, l]));
  s.links = s.links.filter((l) => l.a !== f.id && l.b !== f.id);
  const keepHuman = () => {
    for (const [k, l] of human) {
      const found = s.links.find((x) => `${x.a}|${x.b}` === k);
      if (found) found.human = l.human;
      else s.links.push(l);
    }
  };
  const fam = family(f.analysis?.kind);
  if (!fam) return keepHuman();
  const others = (pool ?? s.feedback).filter((o) => o.id !== f.id && family(o.analysis?.kind) === fam);
  const scored = others
    .map((o) => {
      const t = textScore(f, o);
      const st = stepScore(s, f, o);
      return { o, t, st, pre: 0.7 * t + 0.3 * st };
    })
    // Ideas rarely share a script step, so they get a lower bar to be compared at all.
    .filter((x) => x.pre >= (fam === "idea" ? 0.15 : 0.3) || f.sameAs === x.o.id)
    .sort((x, y) => y.pre - x.pre)
    .slice(0, 4);

  const fText = reportText(f, ctxOf(s, f)) + (answersOf(f) ? `\nFollow-up answers: ${answersOf(f)}` : "");
  const results = await Promise.all(
    scored.map(async (x) => {
      const oText = reportText(x.o, ctxOf(s, x.o)) + (answersOf(x.o) ? `\nFollow-up answers: ${answersOf(x.o)}` : "");
      const name = (id: string) => s.testers.find((t) => t.id === id)?.name.split(" ")[0] ?? "This tester";
      let names: [string, string] = [name(f.testerId), name(x.o.testerId)];
      if (names[0] === names[1]) names = [`${names[0]} (latest)`, `${names[1]} (earlier)`];
      return { ...x, cmp: await compare(fText, oText, names) };
    }),
  );
  for (const r of results) {
    const testerSaid = f.sameAs === r.o.id || r.o.sameAs === f.id;
    const testerDiffers = !!f.notSame?.includes(r.o.id) || !!r.o.notSame?.includes(f.id);
    let score = r.cmp ? 0.4 * r.pre + 0.6 * r.cmp.probabilitySame : r.pre;
    if (testerSaid) score = Math.max(score, 0.9);
    if (testerDiffers) score = Math.min(score, 0.4);
    const verdict: Link["verdict"] = testerDiffers ? "different" : r.cmp
      ? testerSaid && r.cmp.verdict !== "different"
        ? "same"
        : r.cmp.verdict
      : score >= SAME
        ? "same"
        : score >= MAYBE
          ? "unsure"
          : "different";
    if (verdict === "different" && score < MAYBE && !testerSaid && !testerDiffers) continue;
    const [a, b] = pairKey(f.id, r.o.id);
    s.links.push({
      a,
      b,
      score: round(score),
      textScore: round(r.t),
      sameStep: r.st === 1,
      testerSaid,
      verdict,
      same: r.cmp?.same ?? (r.st === 1 ? ["Reported at the same step of the script"] : []),
      differ: [...(testerDiffers ? ["The tester said theirs is different"] : []), ...(r.cmp?.differ ?? [])],
      by: r.cmp ? "model" : "rules",
    });
  }
  keepHuman();
}

export function linksOf(s: Store, id: string) {
  return s.links.filter((l) => l.a === id || l.b === id).sort((x, y) => y.score - x.score);
}

export const otherEnd = (l: Link, id: string) => (l.a === id ? l.b : l.a);

/** Put `f` in the group of its strongest "same" match, or a group of its own. A proposal until a person acts. */
export async function place(s: Store, f: Feedback) {
  if (f.groupId) leave(s, f);
  const fam = family(f.analysis?.kind);
  if (!fam) return;
  const best = linksOf(s, f.id).find((l) => {
    const o = s.feedback.find((x) => x.id === otherEnd(l, f.id));
    if (!o?.groupId || l.human === "different") return false;
    // Ideas gather into themes more loosely than bugs merge into one ticket.
    return l.human === "same" || (l.verdict === "same" && l.score >= (fam === "idea" ? MAYBE : SAME)) || l.testerSaid;
  });
  const other = best ? s.feedback.find((o) => o.id === otherEnd(best, f.id)) : undefined;
  const target = other?.groupId ? s.groups.find((g) => g.id === other.groupId && g.status !== "closed") : undefined;
  if (target && target.status !== "idea") {
    target.memberIds.push(f.id);
    f.groupId = target.id;
    target.draft = null; // a new witness changes the draft
    if (fam === "idea") await retitleIdea(s, target);
    return;
  }
  if (target && target.status === "idea") {
    target.memberIds.push(f.id);
    f.groupId = target.id;
    await retitleIdea(s, target);
    return;
  }
  const g: Group = { id: uid("g"), title: f.analysis?.summary ?? f.text, memberIds: [f.id], status: "open", createdBy: "heard", ticketId: null, draft: null };
  s.groups.push(g);
  f.groupId = g.id;
}

export function leave(s: Store, f: Feedback) {
  const g = s.groups.find((x) => x.id === f.groupId);
  f.groupId = null;
  if (!g) return;
  g.memberIds = g.memberIds.filter((id) => id !== f.id);
  g.draft = null;
  if (g.memberIds.length === 0) s.groups = s.groups.filter((x) => x.id !== g.id);
}

export async function retitleIdea(s: Store, g: Group) {
  const texts = g.memberIds.map((id) => s.feedback.find((f) => f.id === id)?.text ?? "").filter(Boolean);
  if (texts.length < 2) return;
  g.title = (await themeOf(texts)) ?? g.title;
}

/** The full read of one report: understand it, embed it, link it, place it. */
export async function triage(s: Store, f: Feedback) {
  f.analysis = await analyze(f, ctxOf(s, f), answersOf(f));
  const [e] = (await embed([embedText(s, f)])) ?? [];
  if (e) f.embedding = e;
  await relink(s, f);
  await place(s, f);
}

/** Seed path: the same steps as `triage`, batched, in arrival order. */
export async function triageAll(s: Store) {
  const order = [...s.feedback].sort((a, b) => a.at.localeCompare(b.at));
  await pool(order, 8, async (f) => {
    f.analysis = await analyze(f, ctxOf(s, f));
  });
  const vecs = await embed(order.map((f) => embedText(s, f)));
  if (vecs) order.forEach((f, i) => (f.embedding = vecs[i]));
  const seen: Feedback[] = [];
  const jobs: { f: Feedback; earlier: Feedback[] }[] = [];
  for (const f of order) {
    jobs.push({ f, earlier: [...seen] });
    seen.push(f);
  }
  // Each report links only to what had arrived before it, as it would live.
  const linkSets = await pool(jobs, 6, async ({ f, earlier }) => {
    const scratch: Store = { ...s, links: [] };
    await relink(scratch, f, earlier);
    return scratch.links;
  });
  s.links = linkSets.flat();
  for (const f of order) await place(s, f);
  for (const f of order) ack(s, f);
}

/** What the tester sees the moment they press send. Plain, and true: a person reads every note. */
export function ack(s: Store, f: Feedback) {
  const first = s.testers.find((t) => t.id === f.testerId)?.name.split(" ")[0] ?? "there";
  const heard = f.analysis?.summary ? ` We heard: “${toYou(f.analysis.summary)}”` : "";
  f.messages.unshift({
    id: uid("m"),
    at: f.at,
    from: "heard",
    text: `Thanks, ${first}.${heard} A person reads every note — you’ll see what happens to this one here.`,
  });
}

/** The summary is written for the manager; said back to the tester, it talks to them. */
export function toYou(t: string) {
  return t
    .replace(/^The tester's\b/, "Your")
    .replace(/^The tester\b/, "You")
    .replace(/\bthe tester's\b/g, "your")
    .replace(/\bthe tester\b/g, "you")
    .replace(/\b(because|so|and) they\b/g, "$1 you")
    .replace(/\bYou (would|wants|suggests|found|marked|enjoyed|asks|is)\b/, (_m, v: string) => `You ${({ wants: "want", suggests: "suggest", asks: "ask", is: "are" } as Record<string, string>)[v] ?? v}`)
    .replace(/\byou (wants|suggests|asks|is)\b/g, (_m, v: string) => `you ${({ wants: "want", suggests: "suggest", asks: "ask", is: "are" } as Record<string, string>)[v] ?? v}`);
}

export function stamp(s: Store, d: Omit<Store["decisions"][number], "id" | "at" | "by">) {
  s.decisions.push({ id: uid("d"), at: now(), by: s.manager, ...d });
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]!);
      }
    }),
  );
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
