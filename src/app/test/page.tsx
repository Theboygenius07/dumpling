"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CircleCheck, ExternalLink, Lightbulb, ListChecks, Lock, Monitor, Send, TriangleAlert, X } from "lucide-react";
import type { Analysis, Feedback, Script, Step, Verdict } from "@/lib/types";
import { Avatar, Dots, Empty, EVIDENCE, DumplingMark, KIND, Meter, post, testerOf, useStore, type State } from "../ui";

type Similar = { id: string; summary: string; count: number; ticketId: string | null; score: number; sameStep: boolean };
type Coach = { analysis: Analysis | null; similar: Similar[] };

const CHOICES: { v: Verdict; label: string; hint: string; icon: React.ReactNode; bg: string; fg: string; prompt: string }[] = [
  { v: "worked", label: "It worked", hint: "Happened as expected", icon: <Check size={14} strokeWidth={3} />, bg: "var(--green)", fg: "#fff", prompt: "" },
  { v: "failed", label: "It didn’t work", hint: "Broke, stuck or wrong", icon: <X size={14} strokeWidth={3} />, bg: "var(--red)", fg: "#fff", prompt: "What happened instead? Your own words are perfect." },
  { v: "off", label: "Something felt off", hint: "Worked, but…", icon: <TriangleAlert size={13} strokeWidth={2.6} />, bg: "var(--orange)", fg: "#fff", prompt: "What felt off? Even “it was weird” is a good start." },
  { v: "idea", label: "I have an idea", hint: "Could be better", icon: <Lightbulb size={13} strokeWidth={2.6} />, bg: "var(--violet)", fg: "#fff", prompt: "What would make this better?" },
];

export default function TestPage() {
  const { s, testerId } = useStore();
  if (!s) return <div className="page empty"><Dots /></div>;
  if (!s.scripts.length) return <div className="page panel"><Empty icon={<ListChecks size={18} />} title="No test scripts yet">Write the steps testers will follow in <Link className="link" href="/settings?tab=scripts">Settings › Test scripts</Link>.</Empty></div>;
  if (!testerOf(s, testerId)) return <div className="page panel"><Empty icon={<ListChecks size={18} />} title="No testers yet">Add the people testing {s.cycle.product} in <Link className="link" href="/settings?tab=people">Settings › People</Link>, then pick one at the bottom left.</Empty></div>;
  return <Runner key={`${s.workspace}:${testerId}`} s={s} testerId={testerId} />;
}

function Runner({ s, testerId }: { s: State; testerId: string }) {
  const [scriptId, setScriptId] = useState(s.scripts[0]!.id);
  const [local, setLocal] = useState<Record<string, Verdict>>({});
  const tester = testerOf(s, testerId)!;

  const marks = useMemo(() => {
    const m: Record<string, Verdict> = {};
    for (const f of [...s.feedback].sort((a, b) => a.at.localeCompare(b.at))) if (f.testerId === testerId && f.stepId) m[f.stepId] = f.verdict;
    return { ...m, ...local };
  }, [s.feedback, testerId, local]);

  const script = s.scripts.find((x) => x.id === scriptId)!;
  const [current, setCurrent] = useState<string | null>(() => script.steps.find((st) => !marks[st.id])?.id ?? null);
  useEffect(() => { setCurrent(script.steps.find((st) => !marks[st.id])?.id ?? null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scriptId]);

  const done = script.steps.filter((st) => marks[st.id]).length;
  const advance = (st: Step) => setCurrent(script.steps.find((x) => x.n > st.n && !marks[x.id])?.id ?? null);

  return (
    <div className="page runner">
      <aside className="scripts stack-16">
        <div>
          <div className="eyebrow" style={{ padding: "0 10px 6px" }}>Your test scripts</div>
          {s.scripts.map((x) => {
            const n = x.steps.filter((st) => marks[st.id]).length;
            return (
              <button key={x.id} className={`script-btn ${x.id === scriptId ? "on" : ""}`} onClick={() => setScriptId(x.id)}>
                <div className="row between"><span className="t">{x.title}</span><span className="small muted">{n}/{x.steps.length}</span></div>
                <div className="progress" style={{ marginTop: 9 }}><i style={{ width: `${(n / x.steps.length) * 100}%` }} /></div>
              </button>
            );
          })}
        </div>
        <div className="well" style={{ padding: 12 }}>
          <div className="row"><Avatar t={tester} size="sm" /><b style={{ fontWeight: 500, fontSize: 13.5 }}>Testing as {tester.name.split(" ")[0]}</b></div>
          <p className="small muted" style={{ marginTop: 8 }}>{tester.env.browser} · {tester.env.os} · {tester.env.device}. Attached to every note for you — no need to type it.</p>
        </div>
      </aside>

      <section>
        <div className="head" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow">{script.area}</div>
            <h1 style={{ marginTop: 6 }}>{script.title}</h1>
            <p>Follow each step in {s.cycle.product}, then tell us how it went. There are no wrong answers.</p>
          </div>
          <a className="btn" href={s.cycle.productUrl} target="_blank" rel="noreferrer">Open {s.cycle.product} <ExternalLink size={14} /></a>
        </div>
        <div className="row" style={{ marginBottom: 22 }}>
          <div className="progress grow" style={{ height: 6 }}><i style={{ width: `${(done / script.steps.length) * 100}%` }} /></div>
          <span className="small muted" style={{ minWidth: 92, textAlign: "right" }}>{done} of {script.steps.length} done</span>
        </div>

        <div>
          {script.steps.map((st, i) => {
            const mark = marks[st.id];
            const isCur = current === st.id;
            const last = i === script.steps.length - 1;
            return (
              <div key={st.id} className="srow">
                <div className="srail">
                  <span className={`snum ${mark ?? (isCur ? "cur" : "")}`}>{mark === "worked" ? <Check size={15} strokeWidth={3} /> : st.n}</span>
                  {!last && <span className="sline" />}
                </div>
                <div className="sbody">
                  {isCur ? (
                    <StepCard s={s} script={script} step={st} testerId={testerId} mark={mark}
                      onWorked={() => { setLocal((m) => ({ ...m, [st.id]: "worked" })); advance(st); }}
                      onSent={(v) => setLocal((m) => ({ ...m, [st.id]: v }))}
                      onNext={() => advance(st)} />
                  ) : (
                    <button className="scollapsed" onClick={() => setCurrent(st.id)}>
                      <span className="grow clip">{st.action}</span>
                      {mark && <span className={`pill ${mark === "worked" ? "good" : mark === "failed" ? "bug" : mark === "off" ? "warn" : "idea"}`}>{CHOICES.find((c) => c.v === mark)!.label}</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {current === null && done === script.steps.length && (
            <div className="done" style={{ marginLeft: 38 }}>
              <span className="tick"><Check size={16} strokeWidth={3} /></span>
              <div><h3>Script finished — thank you.</h3><p className="small" style={{ marginTop: 4 }}>Everything you sent is with the team. <Link href="/notes" className="link">See what happens to it</Link>.</p></div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StepCard({ s, script, step, testerId, mark, onWorked, onSent, onNext }: {
  s: State; script: Script; step: Step; testerId: string; mark?: Verdict;
  onWorked: () => void; onSent: (v: Verdict) => void; onNext: () => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [sent, setSent] = useState<Feedback | null>(null);
  return (
    <div className="scard">
      <div className="row between">
        <span className="eyebrow">Step {step.n} of {script.steps.length}</span>
        {mark && !sent && <span className="small muted">You’ve reported on this step — you can add another note.</span>}
      </div>
      <div className="sact">{step.action}</div>
      <div className="expect"><CircleCheck size={16} /><span><b style={{ fontWeight: 500, color: "var(--ink)" }}>What should happen: </b>{step.expected}</span></div>

      {sent ? (
        <Sent s={s} f={sent} onNext={onNext} />
      ) : (
        <>
          <div className="label" style={{ marginTop: 16 }}>How did it go?</div>
          <div className="choices" style={{ marginTop: 8 }}>
            {CHOICES.map((c) => (
              <button key={c.v} className={`choice ${verdict === c.v ? "on" : ""}`} onClick={() => (c.v === "worked" ? onWorked() : setVerdict(c.v))}>
                <span className="ic" style={{ background: c.bg, color: c.fg }}>{c.icon}</span>
                <span><b>{c.label}</b><span>{c.hint}</span></span>
              </button>
            ))}
          </div>
          {verdict && verdict !== "worked" && (
            <Composer key={verdict} s={s} testerId={testerId} scriptId={script.id} step={step} verdict={verdict} onSent={(f) => { setSent(f); onSent(verdict); }} />
          )}
        </>
      )}
    </div>
  );
}

function Composer({ s, testerId, scriptId, step, verdict, onSent }: { s: State; testerId: string; scriptId: string; step: Step; verdict: Verdict; onSent: (f: Feedback) => void }) {
  const [text, setText] = useState("");
  const [coach, setCoach] = useState<Coach | null>(null);
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [same, setSame] = useState<Record<string, "yes" | "no">>({});
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  const tester = testerOf(s, testerId)!;
  const choice = CHOICES.find((c) => c.v === verdict)!;

  useEffect(() => {
    if (text.trim().split(/\s+/).filter(Boolean).length < 2) { setCoach(null); setThinking(false); return; }
    const mine = ++seq.current;
    setThinking(true);
    const t = setTimeout(async () => {
      try {
        const r = await post<Coach>("/api/coach", { testerId, scriptId, stepId: step.id, verdict, text });
        if (seq.current === mine) setCoach(r);
      } catch {} finally {
        if (seq.current === mine) setThinking(false);
      }
    }, 850);
    return () => clearTimeout(t);
  }, [text, testerId, scriptId, step.id, verdict]);

  const a = coach?.analysis;
  const sameAs = Object.entries(same).find(([, v]) => v === "yes")?.[0] ?? null;
  const notSame = Object.entries(same).filter(([, v]) => v === "no").map(([k]) => k);
  const pick = (id: string, v: "yes" | "no") => setSame((m) => {
    const n = { ...m };
    if (n[id] === v) delete n[id];
    else { if (v === "yes") for (const k of Object.keys(n)) if (n[k] === "yes") delete n[k]; n[id] = v; }
    return n;
  });

  async function send() {
    setSending(true); setErr(null);
    try {
      onSent(await post<Feedback>("/api/feedback", { testerId, scriptId, stepId: step.id, verdict, text, sameAs, notSame, asked: answer ? a?.question : undefined, answer: answer ?? undefined }));
    } catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  }

  return (
    <div className="compose">
      <div>
        <label className="field">
          <span className="label">Tell us in your own words</span>
          <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={choice.prompt} />
        </label>
        <div className="attached">
          <span><Lock size={12} />Attached for you</span>
          <span><Monitor size={13} />{tester.env.browser} · {tester.env.os} · {tester.env.device}</span>
          <span><ListChecks size={13} />Step {step.n}</span>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary lg" disabled={sending || text.trim().length < 2} onClick={send}>
            {sending ? <>Sending <Dots /></> : <>Send to the team <Send size={15} /></>}
          </button>
          <span className="small muted">A person reads every note.</span>
        </div>
        {err && <p className="small" style={{ color: "var(--bug)", marginTop: 8 }}>{err}</p>}
      </div>

      <div className="coach" aria-live="polite">
        <div className="coach-head">
          <span className="hmark"><DumplingMark size={14} /></span>
          Dumpling
          <span className="spacer" />
          {thinking && <Dots />}
        </div>
        {!a && !thinking && <p className="small muted" style={{ marginTop: 10 }}>As you type, I’ll say back what I understood, check whether someone already reported it, and ask one quick question if anything’s missing.</p>}
        {a && (
          <>
            <div className="bubble">
              <div className="label">Here’s what I understood</div>
              {a.summary}
              <div className="small muted" style={{ marginTop: 6 }}>Sounds like {a.kind === "idea" ? "an idea" : a.kind === "unclear" ? "something’s wrong" : `a ${KIND[a.kind].toLowerCase()}`} · {EVIDENCE[a.evidence].label.toLowerCase()}</div>
            </div>
            {a.question && (
              <div className="bubble">
                <div className="label">One quick question — optional</div>
                {a.question}
                <div className="row wrap" style={{ marginTop: 9, gap: 6 }}>
                  {a.options.map((o) => <button key={o} className={`chipbtn ${answer === o ? "on" : ""}`} onClick={() => setAnswer(answer === o ? null : o)}>{o}</button>)}
                </div>
              </div>
            )}
            {coach!.similar.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="label">Others reported something like this</div>
                {coach!.similar.map((x) => (
                  <div key={x.id} className={`match ${same[x.id] === "yes" ? "on" : ""}`}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4 }}>{x.summary}</div>
                    <div className="row between" style={{ marginTop: 7 }}>
                      <span className="small muted">{x.count} {x.count === 1 ? "report" : "reports"}{x.sameStep ? " · same step" : ""}{x.ticketId ? ` · ${x.ticketId}` : ""}</span>
                      <Meter value={x.score} tone={x.score >= 0.8 ? "good" : "warn"} width={48} />
                    </div>
                    <div className="row" style={{ marginTop: 9, gap: 6 }}>
                      <button className={`chipbtn ${same[x.id] === "yes" ? "on" : ""}`} onClick={() => pick(x.id, "yes")}>Same as mine</button>
                      <button className={`chipbtn ${same[x.id] === "no" ? "on" : ""}`} onClick={() => pick(x.id, "no")}>Different</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Sent({ s, f, onNext }: { s: State; f: Feedback; onNext: () => void }) {
  const g = s.groups.find((x) => x.id === f.groupId);
  const others = g ? g.memberIds.filter((id) => id !== f.id).length : 0;
  const name = testerOf(s, f.testerId)?.name.split(" ")[0];
  const heard = f.messages.find((m) => m.from === "dumpling")?.text.match(/We heard: “([^”]*)”/)?.[1];
  return (
    <div className="done">
      <span className="tick"><Check size={16} strokeWidth={3} /></span>
      <div>
        <h3>Sent — thank you, {name}.</h3>
        {heard && <p style={{ marginTop: 6 }}>We heard: “{heard}”</p>}
        <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
          {others > 0 ? `You’re not the only one — ${others} other ${others === 1 ? "report says" : "reports say"} the same, so yours helps pin it down. ` : ""}
          A person reads every note, and you’ll see what happens to it in My notes.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={onNext}>Next step <ArrowRight size={15} /></button>
          <Link href="/notes" className="btn ghost">Track it in My notes</Link>
        </div>
      </div>
    </div>
  );
}
