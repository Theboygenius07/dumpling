"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { Analysis, Feedback, Group, Kind, Link, Severity, Store, Tester, Ticket } from "@/lib/types";

export type State = Store & { model: boolean };

// ---------- one store, one poll, for the whole app ----------

type Ctx = {
  s: State | null;
  empty: boolean;
  refresh: () => Promise<State | null>;
  testerId: string;
  setTesterId: (id: string) => void;
  toast: (msg: string) => void;
};
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State | null>(null);
  const [empty, setEmpty] = useState(false);
  const [testerId, setTester] = useState("t_grace");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!r) return null;
    if (r.empty) { setEmpty(true); return null; }
    setEmpty(false);
    setS(r);
    return r as State;
  }, []);

  useEffect(() => {
    try { const saved = localStorage.getItem("heard.tester"); if (saved) setTester(saved); } catch {}
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3400);
    return () => clearTimeout(t);
  }, [msg]);

  const setTesterId = useCallback((id: string) => {
    setTester(id);
    try { localStorage.setItem("heard.tester", id); } catch {}
  }, []);

  const value = useMemo(() => ({ s, empty, refresh, testerId, setTesterId, toast: setMsg }), [s, empty, refresh, testerId, setTesterId]);
  return (
    <StoreCtx.Provider value={value}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <span className="tk"><Check size={14} strokeWidth={3} /></span>
          {msg}
        </div>
      )}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}

export async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { message?: string }).message ?? "Something went wrong — try again.");
  return j as T;
}

// ---------- words ----------

export const KIND: Record<Kind, string> = { bug: "Bug", idea: "Idea", question: "Question", praise: "Praise", unclear: "Unclear" };

export const EVIDENCE: Record<Analysis["evidence"], { label: string; tone: string; say: string }> = {
  strong: { label: "Enough to act on", tone: "good", say: "A developer could start on this." },
  some: { label: "Useful, one gap", tone: "info", say: "Good to go — one detail would help." },
  thin: { label: "Needs a little more", tone: "warn", say: "Not enough to act on yet — a kind question will help." },
};

export const SEV: Record<Severity, { label: string; tone: string; say: string }> = {
  blocker: { label: "Blocker", tone: "bug", say: "Stops the step entirely" },
  major: { label: "Major", tone: "warn", say: "Breaks part of the step" },
  minor: { label: "Minor", tone: "ghost", say: "Works, with a problem" },
  cosmetic: { label: "Cosmetic", tone: "ghost", say: "Looks wrong, works" },
};

/** How sure Dumpling is that two notes are one problem — words first, number second. */
export function linkLabel(l: Link) {
  if (l.human === "same") return { text: "You said: same problem", tone: "ink" };
  if (l.human === "different") return { text: "You said: different", tone: "ink" };
  if (l.testerSaid) return { text: "Tester confirmed it’s the same", tone: "good" };
  if (l.verdict === "same" && l.score >= 0.85) return { text: "Very likely the same", tone: "good" };
  if (l.verdict === "same" && l.score >= 0.68) return { text: "Likely the same", tone: "good" };
  if (l.verdict === "related") return { text: "Related, probably not the same", tone: "info" };
  if (l.verdict === "different") return { text: "Probably different", tone: "ghost" };
  return { text: "Not sure — your call", tone: "warn" };
}

const TONE: Record<string, string> = { good: "var(--green)", info: "var(--accent)", warn: "var(--orange)", bug: "var(--red)", ghost: "var(--text-3)", ink: "var(--text)" };

export function Meter({ value, tone = "info", width = 64 }: { value: number; tone?: string; width?: number }) {
  return (
    <span className="meter" title={`${Math.round(value * 100)} out of 100`}>
      <span className="track" style={{ width }}><i style={{ width: `${Math.round(value * 100)}%`, background: TONE[tone] ?? TONE.info }} /></span>
      <b>{Math.round(value * 100)}%</b>
    </span>
  );
}

export function sureWords(c: number) {
  return c >= 0.9 ? "Very sure" : c >= 0.75 ? "Fairly sure" : c >= 0.55 ? "Unsure" : "Guessing";
}

/** Linear-style priority glyph, driven by severity. */
export function Priority({ sev, size = 14 }: { sev: Severity; size?: number }) {
  if (sev === "blocker") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-label="Blocker">
        <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--orange)" />
        <rect x="6.25" y="3.5" width="1.5" height="4.5" rx="0.75" fill="#fff" />
        <circle cx="7" cy="10" r="0.9" fill="#fff" />
      </svg>
    );
  }
  const on = sev === "major" ? 3 : sev === "minor" ? 2 : 1;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label={SEV[sev].label}>
      {[0, 1, 2].map((i) => <rect key={i} x={1.5 + i * 4} y={9 - i * 3} width="3" height={4 + i * 3} rx="1" fill={i < on ? "var(--text-2)" : "var(--border-3)"} />)}
    </svg>
  );
}

/** Linear-style status circle. */
export function Status({ kind, size = 14 }: { kind: "todo" | "progress" | "review" | "done" | "idea" | "known"; size?: number }) {
  const c = { todo: "var(--text-3)", progress: "var(--yellow)", review: "var(--green)", done: "var(--accent)", idea: "var(--violet)", known: "var(--green)" }[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.6" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray={kind === "idea" ? "2 1.6" : undefined} />
      {kind === "progress" && <path d="M7 3.4 A3.6 3.6 0 0 1 7 10.6 Z" fill={c} />}
      {kind === "review" && <path d="M7 3.4 A3.6 3.6 0 1 1 3.4 7 L7 7 Z" fill={c} />}
      {(kind === "done" || kind === "known") && <><circle cx="7" cy="7" r="5.6" fill={c} /><path d="M4.6 7.1l1.7 1.7 3.2-3.4" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>}
    </svg>
  );
}

export const NOTE_ICON: Record<Feedback["status"], "todo" | "progress" | "review" | "done" | "idea"> = {
  new: "todo", asked: "progress", ticketed: "done", idea: "idea", answered: "done", thanked: "done",
};

export function Dots() {
  return <span className="dots" aria-label="Thinking"><i /><i /><i /></span>;
}

/** The mark: a dumpling whose pleats all fold into one point — many notes, one problem. */
export function HeardMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5.2c-5.3 0-9 4.6-9 8.9 0 2.6 2 4.6 4.6 4.6h8.8c2.6 0 4.6-2 4.6-4.6 0-4.3-3.7-8.9-9-8.9z" />
      <path d="M12 5.2c-1 2.6-2.9 4.6-5.6 5.6M12 5.2v6M12 5.2c1 2.6 2.9 4.6 5.6 5.6" />
    </svg>
  );
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="ic">{icon}</span>
      <b style={{ color: "var(--text)", fontWeight: 500 }}>{title}</b>
      {children && <p className="small" style={{ maxWidth: 360 }}>{children}</p>}
    </div>
  );
}

// ---------- people ----------

// Avatar hues, Linear-like: saturated but soft, white initials stay legible.
const HUES = ["#5E6AD2", "#D4483A", "#2F9E6A", "#8E6CE0", "#D2558A", "#1E96B0", "#C77A12"];
export function Avatar({ t, size }: { t?: Pick<Tester, "name">; size?: "sm" | "lg" }) {
  const name = t?.name ?? "?";
  const i = name.split(/\s+/).filter((p) => /^[A-Za-z]/.test(p)).map((p) => p[0]).slice(0, 2).join("");
  const h = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  return <span className={`avatar${size ? ` ${size}` : ""}`} style={{ background: h }} aria-hidden>{i}</span>;
}

export const first = (t?: Pick<Tester, "name">) => t?.name.split(" ")[0] ?? "Someone";

export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ---------- lookups ----------

export function stepOf(s: State, f: Pick<Feedback, "scriptId" | "stepId">) {
  const script = s.scripts.find((x) => x.id === f.scriptId);
  const step = script?.steps.find((x) => x.id === f.stepId);
  return { script, step, label: script ? `${script.title}${step ? ` · Step ${step.n}` : ""}` : "General feedback" };
}

export const testerOf = (s: State, id: string) => s.testers.find((t) => t.id === id);
export const fbOf = (s: State, id: string) => s.feedback.find((f) => f.id === id);
export const groupOf = (s: State, f: Feedback): Group | undefined => s.groups.find((g) => g.id === f.groupId);
export const linksOf = (s: State, id: string) => s.links.filter((l) => l.a === id || l.b === id).sort((x, y) => y.score - x.score);
export const otherEnd = (l: Link, id: string) => (l.a === id ? l.b : l.a);
export const family = (k?: Kind) => (k === "bug" || k === "unclear" ? "bug" : k === "idea" ? "idea" : null);

// ---------- the review queue ----------

export type Item =
  | { type: "group"; id: string; g: Group; members: Feedback[]; family: "bug" | "idea"; title: string }
  | { type: "known"; id: string; g: Group; t: Ticket; fresh: Feedback[]; title: string }
  | { type: "single"; id: string; f: Feedback; title: string };

const SEV_W: Record<Severity, number> = { blocker: 4, major: 3, minor: 2, cosmetic: 1 };
export const topSeverity = (fs: Feedback[]) => fs.map((f) => f.analysis?.severity ?? "minor").sort((a, b) => SEV_W[b] - SEV_W[a])[0] ?? "minor";

export function queue(s: State): Item[] {
  const items: (Item & { rank: number })[] = [];
  for (const g of s.groups) {
    const members = g.memberIds.map((id) => fbOf(s, id)!).filter(Boolean);
    const fresh = members.filter((f) => f.status === "new");
    if (!fresh.length) continue;
    if (g.status === "ticketed") {
      const t = s.tickets.find((x) => x.id === g.ticketId);
      if (t) items.push({ type: "known", id: g.id, g, t, fresh, title: t.title, rank: 60 });
      continue;
    }
    if (g.status !== "open") continue;
    const fam = family(members[0]?.analysis?.kind) ?? "bug";
    const sev = SEV_W[topSeverity(members)];
    const thin = members.every((f) => f.analysis?.evidence === "thin");
    items.push({ type: "group", id: g.id, g, members, family: fam, title: g.draft?.title ?? g.title, rank: fam === "bug" ? sev * 10 + members.length * 4 - (thin ? 15 : 0) : 8 + members.length });
  }
  for (const f of s.feedback) {
    if (f.status !== "new" || f.groupId) continue;
    items.push({ type: "single", id: f.id, f, title: `“${f.text}”`, rank: f.analysis?.kind === "question" ? 6 : 3 });
  }
  return items.sort((a, b) => b.rank - a.rank);
}

export const NOTE_STATUS: Record<Feedback["status"], { label: string; tone: string }> = {
  new: { label: "With the team", tone: "info" },
  asked: { label: "Question for you", tone: "warn" },
  ticketed: { label: "Became a ticket", tone: "good" },
  idea: { label: "In the ideas backlog", tone: "idea" },
  answered: { label: "Answered", tone: "good" },
  thanked: { label: "Passed to the team", tone: "praise" },
};
