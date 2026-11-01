"use client";
import { useCallback, useEffect, useState } from "react";
import type { Analysis, Feedback, Group, Kind, Link, Store, Tester } from "@/lib/types";

export type State = Store & { model: boolean };

export function useStore() {
  const [s, setS] = useState<State | null>(null);
  const [empty, setEmpty] = useState(false);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" }).then((r) => r.json());
    if (r.empty) {
      setEmpty(true);
      return null;
    }
    setEmpty(false);
    setS(r);
    return r as State;
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);
  return { s, empty, refresh };
}

export async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { message?: string }).message ?? "Something went wrong — try again.");
  return j as T;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return { toast: setMsg, Toast: () => (msg ? <div className="toast">{msg}</div> : null) };
}

// ---------- words ----------

export const KIND: Record<Kind, string> = { bug: "Bug", idea: "Idea", question: "Question", praise: "Praise", unclear: "Not sure yet" };

export const EVIDENCE: Record<Analysis["evidence"], { label: string; tone: string; say: string }> = {
  strong: { label: "Enough to act on", tone: "good", say: "A developer could start on this." },
  some: { label: "Useful, one gap", tone: "accent", say: "Good to go — one detail would help." },
  thin: { label: "Needs a little more", tone: "warn", say: "Not enough to act on yet — a kind question will help." },
};

export const SEV_TONE: Record<string, string> = { blocker: "bad", major: "warn", minor: "line", cosmetic: "line" };

export const VERDICT_LABEL = { worked: "Worked", failed: "Didn’t work", off: "Something’s off", idea: "Idea" } as const;

/** How sure Heard is that two notes are one problem, in words first and a number second. */
export function linkLabel(l: Link) {
  if (l.human === "same") return { text: "A person said: same", tone: "ink" };
  if (l.human === "different") return { text: "A person said: different", tone: "ink" };
  if (l.testerSaid) return { text: "The tester said it’s the same", tone: "good" };
  if (l.verdict === "same" && l.score >= 0.85) return { text: "Very likely the same", tone: "good" };
  if (l.verdict === "same" && l.score >= 0.68) return { text: "Likely the same", tone: "good" };
  if (l.verdict === "related") return { text: "Related — probably not the same", tone: "accent" };
  if (l.verdict === "different") return { text: "Probably different", tone: "line" };
  return { text: "Not sure — your call", tone: "warn" };
}

const TONE_COLOR: Record<string, string> = { good: "var(--green)", accent: "var(--teal)", warn: "var(--marigold)", bad: "var(--vermilion)", line: "var(--muted)", ink: "var(--ink)" };

export function Meter({ value, tone = "accent", label }: { value: number; tone?: string; label?: string }) {
  return (
    <span className="meter" title={`${Math.round(value * 100)} out of 100`}>
      <span className="bar">
        <i style={{ width: `${Math.round(value * 100)}%`, background: TONE_COLOR[tone] ?? "var(--accent)" }} />
      </span>
      <b>{Math.round(value * 100)}%</b>
      {label && <span>{label}</span>}
    </span>
  );
}

export function sureWords(c: number) {
  return c >= 0.9 ? "very sure" : c >= 0.75 ? "fairly sure" : c >= 0.55 ? "unsure" : "guessing";
}

// ---------- people ----------

// chalk's crayons, deep enough to carry white initials.
const HUES = ["#1E2B40", "#E4492A", "#148F48", "#6F70B8", "#D2558A", "#2E9C8F", "#C98100"];
export function Avatar({ t, sm }: { t?: Tester; sm?: boolean }) {
  const name = t?.name ?? "?";
  const i = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("");
  const h = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  return (
    <span className={`avatar${sm ? " sm" : ""}`} style={{ background: h }} aria-hidden>
      {i}
    </span>
  );
}

export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

// ---------- lookups ----------

export function stepOf(s: State, f: Pick<Feedback, "scriptId" | "stepId">) {
  const script = s.scripts.find((x) => x.id === f.scriptId);
  const step = script?.steps.find((x) => x.id === f.stepId);
  return { script, step, label: script ? `${script.title}${step ? ` · step ${step.n}` : ""}` : "Free feedback" };
}

export const testerOf = (s: State, id: string) => s.testers.find((t) => t.id === id);
export const fbOf = (s: State, id: string) => s.feedback.find((f) => f.id === id);
export const groupOf = (s: State, f: Feedback): Group | undefined => s.groups.find((g) => g.id === f.groupId);
export const linksOf = (s: State, id: string) => s.links.filter((l) => l.a === id || l.b === id).sort((x, y) => y.score - x.score);
export const otherEnd = (l: Link, id: string) => (l.a === id ? l.b : l.a);

export const STATUS_WORDS: Record<Feedback["status"], { label: string; tone: string }> = {
  new: { label: "With the team", tone: "accent" },
  asked: { label: "We asked you something", tone: "warn" },
  ticketed: { label: "Became a ticket", tone: "good" },
  idea: { label: "In the ideas backlog", tone: "idea" },
  answered: { label: "Answered", tone: "good" },
  thanked: { label: "Passed to the team", tone: "praise" },
};

export function Loading({ empty }: { empty: boolean }) {
  if (!empty) return <div className="page empty">Loading the cycle…</div>;
  return (
    <div className="page empty">
      <p>No test cycle yet.</p>
      <button className="btn primary" style={{ marginTop: 12 }} onClick={async () => { await fetch("/api/seed", { method: "POST" }); location.reload(); }}>
        Start the chalk beta cycle
      </button>
    </div>
  );
}
