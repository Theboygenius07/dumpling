import OpenAI from "openai";
import type { Analysis, Feedback, Kind, Script, Severity, Step, Tester, TicketDraft } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const EMBED = "text-embedding-3-small";

// The product under test comes from the workspace, not from this file: Dumpling
// works for any product, and chalk is just the first workspace.
let PRODUCT = { name: "the product", about: "" };
export function setProduct(p: { product: string; productAbout?: string }) {
  PRODUCT = { name: p.product || "the product", about: p.productAbout ?? "" };
}
const P = () => (PRODUCT.about ? `${PRODUCT.name}, ${PRODUCT.about}` : PRODUCT.name);

let client: OpenAI | null | undefined;
function ai(): OpenAI | null {
  if (client === undefined) client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 }) : null;
  return client;
}

async function json<T>(system: string, user: string): Promise<T | null> {
  const c = ai();
  if (!c) return null;
  try {
    const res = await c.chat.completions.create({
      model: MODEL,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    } as Parameters<typeof c.chat.completions.create>[0] & { stream?: false });
    const text = (res as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("[heard] model call failed:", (e as Error).message);
    return null;
  }
}

export type Context = { tester?: Tester; script?: Script; step?: Step };

export function contextFor(f: Pick<Feedback, "testerId" | "scriptId" | "stepId">, testers: Tester[], scripts: Script[]): Context {
  const script = scripts.find((s) => s.id === f.scriptId);
  return { tester: testers.find((t) => t.id === f.testerId), script, step: script?.steps.find((s) => s.id === f.stepId) };
}

function describe(f: Pick<Feedback, "verdict" | "text">, ctx: Context, extra = "") {
  return [
    ctx.script ? `Test script: "${ctx.script.title}" (${ctx.script.area})` : "Test script: none — free feedback",
    ctx.step ? `Step ${ctx.step.n}: ${ctx.step.action}\nExpected: ${ctx.step.expected}` : "",
    `Tester marked the step: ${f.verdict}`,
    ctx.tester ? `Tester environment: ${ctx.tester.env.browser}, ${ctx.tester.env.os}, ${ctx.tester.env.device}` : "",
    `Tester wrote: """${f.text}"""`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- reading one report ----------

const ANALYZE = () => `You help run user acceptance testing (UAT) for a product called ${P()}.
A tester has written feedback in their own words. Read it the way a careful, kind UAT manager would.
Return JSON with exactly these keys:
- kind: "bug" (something did not work as the step expected), "idea" (a request or suggestion), "question" (they are asking how something works), "praise", or "unclear" (cannot tell yet).
- kindConfidence: 0..1, how sure you are of kind. Be honest: a two-word note is never above 0.6.
- kindWhy: one short sentence quoting the words that decided it.
- summary: the tester's point restated plainly in one sentence about what happened ("The board never finished drawing after about 3 minutes."). Describe what happened, not the person: avoid "the tester".
- actual: what happened, in their words where possible ("" if unknown).
- expected: what should have happened, usually the step's expected result ("" if not a bug).
- evidence: "strong" (a developer could start), "some" (useful but gaps), or "thin" (nothing to act on yet).
- missing: up to 3 short things a developer would still need (e.g. "how long they waited", "whether the cursor appeared"). [] if none.
- question: if evidence is thin or some, ONE warm, specific question to the tester that a busy person can answer in five seconds. Never blame, never ask for logs or technical terms. Thank them first in a few words. "" if evidence is strong or kind is praise.
- options: 2-4 one-tap answers to that question ([] if no question).
- severity: "blocker" (stops the step entirely), "major", "minor", or "cosmetic". For ideas, questions and praise use "minor".
- severityWhy: one short sentence.
- facts: 1-4 short atomic facts from the note (e.g. "waited ~3 minutes", "console: WebSocket closed (1006)", "on iPad"). Only what they actually said.
Never invent details the tester did not give.`;

export async function analyze(f: Pick<Feedback, "verdict" | "text">, ctx: Context, answers = "", captured = ""): Promise<Analysis> {
  const extra = [answers ? `Their answers to follow-up questions: ${answers}` : "", captured ? `Captured automatically by the app (not written by the user): ${captured}` : ""].filter(Boolean).join("\n");
  const out = await json<Partial<Analysis>>(ANALYZE(), describe(f, ctx, extra));
  if (out && typeof out.summary === "string") {
    return {
      kind: (["bug", "idea", "question", "praise", "unclear"] as Kind[]).includes(out.kind as Kind) ? (out.kind as Kind) : "unclear",
      kindConfidence: clamp(Number(out.kindConfidence ?? 0.5)),
      kindWhy: String(out.kindWhy ?? ""),
      summary: out.summary,
      actual: String(out.actual ?? ""),
      expected: String(out.expected ?? ""),
      evidence: out.evidence === "strong" || out.evidence === "some" ? out.evidence : "thin",
      missing: Array.isArray(out.missing) ? out.missing.map(String).slice(0, 3) : [],
      question: String(out.question ?? ""),
      options: Array.isArray(out.options) ? out.options.map(String).slice(0, 4) : [],
      severity: (["blocker", "major", "minor", "cosmetic"] as Severity[]).includes(out.severity as Severity) ? (out.severity as Severity) : "minor",
      severityWhy: String(out.severityWhy ?? ""),
      facts: Array.isArray(out.facts) ? out.facts.map(String).slice(0, 4) : [],
      by: "model",
    };
  }
  return rules(f, ctx);
}

/** The fallback when there is no model: plain rules, labelled as such. */
function rules(f: Pick<Feedback, "verdict" | "text">, ctx: Context): Analysis {
  const t = f.text.toLowerCase();
  const words = f.text.trim().split(/\s+/).length;
  const kind: Kind =
    f.verdict === "idea" || /would love|could you add|please add|can i |let me |it would be nice/.test(t)
      ? "idea"
      : /\?$/.test(f.text.trim()) && f.verdict !== "failed"
        ? "question"
        : f.verdict === "worked" && /love|great|delight|nice/.test(t)
          ? "praise"
          : words < 5
            ? "unclear"
            : "bug";
  const thin = words < 6;
  return {
    kind,
    kindConfidence: thin ? 0.4 : 0.65,
    kindWhy: thin ? "Only a few words, so this is a guess." : `Marked “${f.verdict}” on this step.`,
    summary: f.text.length > 140 ? `${f.text.slice(0, 137)}…` : f.text,
    actual: kind === "bug" ? f.text : "",
    expected: kind === "bug" ? (ctx.step?.expected ?? "") : "",
    evidence: thin ? "thin" : words < 15 ? "some" : "strong",
    missing: thin ? ["what they saw on screen", "how long they waited"] : [],
    question: thin ? "Thanks for flagging this! What did you see on the screen when it went wrong?" : "",
    options: thin ? ["Nothing at all", "A spinner that never stopped", "An error message"] : [],
    severity: kind === "bug" ? (f.verdict === "failed" ? "major" : "minor") : "minor",
    severityWhy: f.verdict === "failed" ? "The step did not complete." : "The step completed with a problem.",
    facts: [],
    by: "rules",
  };
}

// ---------- duplicates ----------

export async function embed(texts: string[]): Promise<number[][] | null> {
  const c = ai();
  if (!c || texts.length === 0) return null;
  try {
    const res = await c.embeddings.create({ model: EMBED, input: texts });
    return res.data.map((d) => d.embedding);
  } catch (e) {
    console.error("[heard] embedding failed:", (e as Error).message);
    return null;
  }
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Words, for the no-model fallback. */
export function overlap(a: string, b: string) {
  const w = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  const A = w(a), B = w(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / Math.max(1, Math.min(A.size, B.size));
}

const COMPARE = () => `You help run user acceptance testing for ${P()}. Two testers wrote feedback.
Decide whether they describe the SAME underlying problem (one fix would resolve both), a RELATED one (same area, different fault — e.g. slow vs never finishes), DIFFERENT problems, or you are UNSURE because one report is too thin to tell.
Return JSON:
- verdict: "same" | "related" | "different" | "unsure"
- probabilitySame: 0..1, calibrated. Thin reports must stay between 0.35 and 0.65 — say unsure rather than guess.
- same: up to 3 short reasons they match, each quoting or naming the shared detail.
- differ: up to 3 short reasons they might not match (different outcome, browser, step, or missing detail). Always give at least one if probabilitySame < 0.9.
Write reasons in plain language for a UAT manager. Refer to the notes by the tester's first name ("Bayo's note", "Femi saw"), never "Report A" or "Report B". Keep each reason under 15 words.`;

export type Comparison = { verdict: "same" | "related" | "different" | "unsure"; probabilitySame: number; same: string[]; differ: string[] };

export async function compare(a: string, b: string, names: [string, string] = ["A", "B"]): Promise<Comparison | null> {
  const out = await json<Partial<Comparison>>(COMPARE(), `${names[0]}'s note:\n${a}\n\n${names[1]}'s note:\n${b}`);
  if (!out || typeof out.probabilitySame !== "number") return null;
  const verdict = (["same", "related", "different", "unsure"] as const).includes(out.verdict as never) ? (out.verdict as Comparison["verdict"]) : "unsure";
  // The number shown must agree with the words shown: a "different" can't carry 0.9.
  const [lo, hi] = { same: [0.6, 1], related: [0.25, 0.6], unsure: [0.35, 0.65], different: [0, 0.3] }[verdict];
  return {
    verdict,
    probabilitySame: Math.max(lo, Math.min(hi, clamp(out.probabilitySame))),
    same: Array.isArray(out.same) ? out.same.map(String).slice(0, 3) : [],
    differ: Array.isArray(out.differ) ? out.differ.map(String).slice(0, 3) : [],
  };
}

export const reportText = (f: Pick<Feedback, "verdict" | "text">, ctx: Context) => describe(f, ctx);

// ---------- drafts a person approves ----------

const TICKET = () => `You draft a bug ticket for a developer from UAT feedback on ${P()}. Several testers may describe the same bug.
Return JSON:
- title: under 70 characters, names the symptom and where ("Board never finishes drawing on Safari").
- severity: "blocker" | "major" | "minor" | "cosmetic"
- severityWhy: one sentence a manager can check.
- steps: reproduction steps as an array of short imperative strings, taken from the test script up to the failing step, plus any condition the testers mention.
- expected: one sentence.
- actual: one or two sentences combining what the testers saw. Never invent.
- notes: environments seen and any pattern (e.g. "3 of 4 on Safari"), and what is still unknown.
- credits: an object mapping each report id to the one most useful detail THAT report adds (short phrase, their words where possible).`;

export async function draftTicket(input: string): Promise<(TicketDraft & { credits: Record<string, string> }) | null> {
  const out = await json<Partial<TicketDraft & { credits: Record<string, string> }>>(TICKET(), input);
  if (!out || typeof out.title !== "string") return null;
  return {
    title: out.title,
    severity: (["blocker", "major", "minor", "cosmetic"] as Severity[]).includes(out.severity as Severity) ? (out.severity as Severity) : "major",
    severityWhy: String(out.severityWhy ?? ""),
    steps: Array.isArray(out.steps) ? out.steps.map(String) : [],
    expected: String(out.expected ?? ""),
    actual: String(out.actual ?? ""),
    notes: String(out.notes ?? ""),
    credits: out.credits && typeof out.credits === "object" ? (out.credits as Record<string, string>) : {},
  };
}

const REPLY = () => `You write a short message from a UAT manager to a tester who gave feedback on ${P()}.
The tester gave their time; make them feel heard. Warm, plain, specific to what they said, 2-3 sentences, no corporate phrases, no exclamation overload.
Purposes:
- "not-a-bug": explain kindly that it works as designed and WHY (use the reason given), and thank them for noticing.
- "answer": answer their question using the facts given.
- "idea": say it is an idea rather than a bug, that it is in the ideas backlog, and how many others asked for something similar.
- "thank": thank them for the kind words and say who it is passed to.
- "ask": ask one specific question that would help, with 2-4 one-tap answers.
Return JSON: { "text": string, "options": string[] } (options only for "ask", else []).`;

export async function draftReply(purpose: string, input: string): Promise<{ text: string; options: string[] } | null> {
  const out = await json<{ text?: string; options?: string[] }>(REPLY(), `Purpose: ${purpose}\n${input}`);
  if (!out || typeof out.text !== "string") return null;
  return { text: out.text, options: Array.isArray(out.options) ? out.options.map(String).slice(0, 4) : [] };
}

const TITLE = () => `Write a short title for a bug report from UAT on ${P()}, the way a good bug tracker would: under 55 characters, names the symptom and where it happens ("Share link asks viewers to sign in"). No full stop. Never mention "the tester". Return JSON {"title": string}.`;

export async function titleOf(texts: string[]): Promise<string | null> {
  const out = await json<{ title?: string }>(TITLE(), texts.map((t, i) => `${i + 1}. ${t}`).join("\n"));
  return typeof out?.title === "string" && out.title.trim() ? out.title.trim().replace(/\.$/, "") : null;
}

const THEME = () => `Name the product idea (or the shared theme of several ideas) from testers in 2-5 words, like a backlog item (e.g. "Export and print boards", "Choose the narrator's voice"). Return JSON {"theme": string}.`;

export async function themeOf(texts: string[]): Promise<string | null> {
  const out = await json<{ theme?: string }>(THEME(), texts.map((t, i) => `${i + 1}. ${t}`).join("\n"));
  return typeof out?.theme === "string" ? out.theme : null;
}

export const hasModel = () => ai() !== null;

function clamp(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}
