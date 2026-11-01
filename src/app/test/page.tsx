"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis, Feedback, Verdict } from "@/lib/types";
import { Avatar, EVIDENCE, KIND, Loading, Meter, STATUS_WORDS, ago, post, stepOf, testerOf, useStore, useToast, type State } from "../ui";

type Similar = { id: string; summary: string; count: number; ticketId: string | null; score: number; sameStep: boolean };
type Coach = { analysis: Analysis | null; similar: Similar[] };

const VERDICTS: { v: Verdict; label: string; cls: string; hint: string }[] = [
  { v: "worked", label: "Worked", cls: "good", hint: "" },
  { v: "failed", label: "Didn’t work", cls: "bad", hint: "What happened instead? Your own words are perfect." },
  { v: "off", label: "Something’s off", cls: "warn", hint: "What felt wrong? Even “it was weird” is a start." },
  { v: "idea", label: "I have an idea", cls: "idea", hint: "What would make this better?" },
];

export default function TestPage() {
  const { s, empty, refresh } = useStore();
  const [testerId, setTesterId] = useState("t_grace");
  const [tab, setTab] = useState<"run" | "notes">("run");
  if (!s) return <Loading empty={empty} />;
  const tester = testerOf(s, testerId)!;
  const mine = s.feedback.filter((f) => f.testerId === testerId).sort((a, b) => b.at.localeCompare(a.at));
  const waiting = mine.filter((f) => f.messages.some((m) => m.question && !m.answered)).length;

  return (
    <div className="page split">
      <aside className="stack sticky">
        <div className="card">
          <div className="eyebrow">Testing as</div>
          <div className="who" style={{ marginTop: 8 }}>
            <Avatar t={tester} />
            <select value={testerId} onChange={(e) => setTesterId(e.target.value)} style={{ fontWeight: 600 }}>
              {s.testers.filter((t) => t.id !== "t_field").map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            {tester.env.browser} · {tester.env.os} · {tester.env.device}
            <br />Attached to every note automatically — no need to type it.
          </p>
        </div>
        <div className="list">
          <button className={`item ${tab === "run" ? "on" : ""}`} onClick={() => setTab("run")}>
            <div className="row"><span className="chip accent">Test scripts</span></div>
            <div className="t">{s.cycle.name}</div>
          </button>
          <button className={`item ${tab === "notes" ? "on" : ""}`} onClick={() => setTab("notes")}>
            <div className="row">
              <span className="chip">My notes · {mine.length}</span>
              {waiting > 0 && <span className="chip warn">{waiting} question{waiting > 1 ? "s" : ""} for you</span>}
            </div>
            <div className="t">What happened to everything you told us</div>
          </button>
        </div>
        <Heardness mine={mine} />
      </aside>
      {tab === "run" ? <Runner s={s} testerId={testerId} refresh={refresh} onNotes={() => setTab("notes")} /> : <Notes s={s} mine={mine} refresh={refresh} />}
    </div>
  );
}

function Heardness({ mine }: { mine: Feedback[] }) {
  if (!mine.length) return null;
  const replied = mine.filter((f) => f.messages.some((m) => m.from === "manager")).length;
  const tickets = mine.filter((f) => f.status === "ticketed").length;
  const ideas = mine.filter((f) => f.status === "idea").length;
  return (
    <div className="card flat small">
      <div className="eyebrow">Your notes so far</div>
      <p style={{ marginTop: 6 }}>
        <b>{mine.length}</b> sent · <b>{tickets}</b> became tickets · <b>{ideas}</b> in ideas · <b>{replied}</b> got a personal reply
      </p>
    </div>
  );
}

// ---------- running a script ----------

function Runner({ s, testerId, refresh, onNotes }: { s: State; testerId: string; refresh: () => Promise<unknown>; onNotes: () => void }) {
  const [scriptId, setScriptId] = useState("s_board");
  const script = s.scripts.find((x) => x.id === scriptId)!;
  const [open, setOpen] = useState<string | null>(script.steps[0]!.id);
  const [local, setLocal] = useState<Record<string, Verdict>>({});
  useEffect(() => setLocal({}), [testerId]);

  const marks = useMemo(() => {
    const m: Record<string, Verdict> = {};
    for (const f of s.feedback) if (f.testerId === testerId && f.stepId) m[f.stepId] = f.verdict;
    return { ...m, ...local };
  }, [s.feedback, testerId, local]);

  return (
    <section className="stack">
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">{s.cycle.name}</div>
          <h1 style={{ marginTop: 4 }}>Test {s.cycle.product} with us</h1>
          <p className="lede">Follow each step in chalk, then tell us how it went. There are no wrong answers — “it felt weird” is useful.</p>
        </div>
        <a className="btn" href={s.cycle.productUrl} target="_blank" rel="noreferrer">Open chalk ↗</a>
      </div>
      <div className="row wrap">
        {s.scripts.map((x) => (
          <button key={x.id} className={`btn ${x.id === scriptId ? "ink" : ""}`} onClick={() => { setScriptId(x.id); setOpen(x.steps[0]!.id); }}>
            {x.title}
          </button>
        ))}
      </div>
      <div className="stack-sm">
        {script.steps.map((st) => (
          <StepCard
            key={st.id}
            s={s}
            testerId={testerId}
            scriptId={script.id}
            step={st}
            mark={marks[st.id]}
            open={open === st.id}
            onOpen={() => setOpen(open === st.id ? null : st.id)}
            onDone={(v) => {
              setLocal((m) => ({ ...m, [st.id]: v }));
              const next = script.steps.find((x) => x.n === st.n + 1);
              if (v === "worked") setOpen(next?.id ?? null);
              refresh();
            }}
            onNotes={onNotes}
          />
        ))}
      </div>
    </section>
  );
}

function StepCard(props: {
  s: State; testerId: string; scriptId: string; step: State["scripts"][number]["steps"][number]; mark?: Verdict; open: boolean;
  onOpen: () => void; onDone: (v: Verdict) => void; onNotes: () => void;
}) {
  const { step, mark, open } = props;
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [sent, setSent] = useState<Feedback | null>(null);
  useEffect(() => { setVerdict(null); setSent(null); }, [props.testerId]);
  const markLabel = VERDICTS.find((v) => v.v === mark)?.label;

  return (
    <div className={`step ${open ? "on" : ""} ${mark ? `done-${mark}` : ""}`}>
      <div className="row" style={{ cursor: "pointer", alignItems: "flex-start" }} onClick={props.onOpen}>
        <span className="n">{mark === "worked" ? "✓" : step.n}</span>
        <div className="grow">
          <div className="act">{step.action}</div>
          <div className="exp"><b>Expected · </b>{step.expected}</div>
        </div>
        {markLabel && <span className={`chip ${VERDICTS.find((v) => v.v === mark)?.cls}`}>{markLabel}</span>}
      </div>
      {open && !sent && (
        <div className="fade-in" style={{ marginTop: 14 }}>
          <div className="row wrap">
            {VERDICTS.map((v) => (
              <button
                key={v.v}
                className={`btn ${v.cls} ${verdict === v.v ? "sel" : ""}`}
                onClick={() => (v.v === "worked" ? props.onDone("worked") : setVerdict(v.v))}
              >
                {v.label}
              </button>
            ))}
          </div>
          {verdict && verdict !== "worked" && (
            <Composer
              s={props.s}
              testerId={props.testerId}
              scriptId={props.scriptId}
              stepId={step.id}
              verdict={verdict}
              onSent={(f) => { setSent(f); props.onDone(verdict); }}
            />
          )}
        </div>
      )}
      {open && sent && (
        <div className="fade-in card flat" style={{ marginTop: 14 }}>
          <div className="row"><span className="chip good"><span className="dot" /> Sent</span><span className="small muted">A person reads every note</span></div>
          <p style={{ marginTop: 8 }}>{sent.messages[0]?.text}</p>
          {sent.groupId && (() => {
            const g = props.s.groups.find((x) => x.id === sent.groupId);
            return g && g.memberIds.length > 1 ? <p className="small" style={{ marginTop: 6 }}>You’re not the only one — {g.memberIds.length - 1} other {g.memberIds.length - 1 === 1 ? "tester" : "testers"} saw something like this. Your note backs theirs up.</p> : null;
          })()}
          <button className="btn sm" style={{ marginTop: 10 }} onClick={props.onNotes}>Follow it in My notes →</button>
        </div>
      )}
    </div>
  );
}

function Composer({ s, testerId, scriptId, stepId, verdict, onSent }: { s: State; testerId: string; scriptId: string; stepId: string; verdict: Verdict; onSent: (f: Feedback) => void }) {
  const [text, setText] = useState("");
  const [coach, setCoach] = useState<Coach | null>(null);
  const [listening, setListening] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [same, setSame] = useState<Record<string, "yes" | "no">>({});
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  const hint = VERDICTS.find((v) => v.v === verdict)!.hint;

  useEffect(() => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words < 1) { setCoach(null); return; }
    const mine = ++seq.current;
    setListening(true);
    const t = setTimeout(async () => {
      try {
        const r = await post<Coach>("/api/coach", { testerId, scriptId, stepId, verdict, text });
        if (seq.current === mine) setCoach(r);
      } finally {
        if (seq.current === mine) setListening(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [text, testerId, scriptId, stepId, verdict]);

  const a = coach?.analysis;
  const sameAs = Object.entries(same).find(([, v]) => v === "yes")?.[0] ?? null;
  const notSame = Object.entries(same).filter(([, v]) => v === "no").map(([k]) => k);
  const mark = (id: string, v: "yes" | "no") =>
    setSame((m) => {
      const n = { ...m };
      if (n[id] === v) delete n[id];
      else {
        if (v === "yes") for (const k of Object.keys(n)) if (n[k] === "yes") delete n[k];
        n[id] = v;
      }
      return n;
    });

  async function send() {
    setSending(true);
    setErr(null);
    try {
      const f = await post<Feedback>("/api/feedback", { testerId, scriptId, stepId, verdict, text, sameAs, notSame, asked: answer ? a?.question : undefined, answer: answer ?? undefined });
      onSent(f);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid-2 fade-in" style={{ marginTop: 14, alignItems: "start" }}>
      <div className="stack-sm">
        <label className="field">
          <span>In your own words</span>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={hint} rows={5} />
        </label>
        <p className="small muted">Your browser, device and this step are attached for you.</p>
        <div className="row">
          <button className="btn primary lg" disabled={sending || text.trim().length < 2} onClick={send}>
            {sending ? "Sending…" : "Send to the team"}
          </button>
          {a?.question && !answer && <span className="small muted">You can send without answering the question.</span>}
        </div>
        {err && <p className="small" style={{ color: "var(--bad)" }}>{err}</p>}
      </div>

      <div className="coach stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="eyebrow">Heard is listening</div>
          {listening && <span className="listening"><span className="dots"><i /><i /><i /></span> reading</span>}
        </div>
        {!a && <p className="small muted">As you type, Heard says back what it understood, checks whether someone else already reported it, and asks one small question if something’s missing.</p>}
        {a && (
          <>
            <div>
              <div className="small muted">What we understood</div>
              <p style={{ marginTop: 2, fontWeight: 500 }}>{a.summary}</p>
              <div className="row wrap" style={{ marginTop: 6 }}>
                <span className={`chip ${a.kind}`}>{KIND[a.kind]}</span>
                <span className={`chip ${EVIDENCE[a.evidence].tone}`}>{EVIDENCE[a.evidence].label}</span>
              </div>
            </div>
            {a.question && (
              <div className="card flat fade-in">
                <div className="small muted">One small question — optional</div>
                <p style={{ marginTop: 2 }}>{a.question}</p>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  {a.options.map((o) => (
                    <button key={o} className={`option ${answer === o ? "sel" : ""}`} onClick={() => setAnswer(answer === o ? null : o)}>{o}</button>
                  ))}
                </div>
              </div>
            )}
            {coach!.similar.length > 0 && (
              <div className="stack-sm fade-in">
                <div className="small muted">Someone may have seen this already</div>
                {coach!.similar.map((x) => (
                  <div key={x.id} className="card" style={{ padding: 12 }}>
                    <p style={{ fontWeight: 500 }}>{x.summary}</p>
                    <div className="row wrap small" style={{ marginTop: 6 }}>
                      <Meter value={x.score} tone={x.score >= 0.75 ? "good" : "warn"} label="alike" />
                      {x.sameStep && <span className="chip line">same step</span>}
                      <span className="chip line">{x.count} {x.count === 1 ? "report" : "reports"}</span>
                      {x.ticketId && <span className="chip good">already ticket {x.ticketId}</span>}
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className={`option ${same[x.id] === "yes" ? "sel" : ""}`} onClick={() => mark(x.id, "yes")}>Same thing</button>
                      <button className={`option ${same[x.id] === "no" ? "sel" : ""}`} onClick={() => mark(x.id, "no")}>Mine’s different</button>
                    </div>
                  </div>
                ))}
                <p className="small muted">Either way, send it — a second report of the same problem helps the team fix it.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- what happened to my notes ----------

function Notes({ s, mine, refresh }: { s: State; mine: Feedback[]; refresh: () => Promise<unknown> }) {
  if (!mine.length) return <div className="card empty">Nothing sent yet. Every note you send shows up here, with what happened to it.</div>;
  return (
    <section className="stack">
      <div>
        <h1>My notes</h1>
        <p className="lede">Every note gets read by a person. Here’s where each one is — including the ones that didn’t become a ticket.</p>
      </div>
      {mine.map((f) => <Note key={f.id} s={s} f={f} refresh={refresh} />)}
    </section>
  );
}

function Note({ s, f, refresh }: { s: State; f: Feedback; refresh: () => Promise<unknown> }) {
  const st = STATUS_WORDS[f.status];
  const open = f.messages.find((m) => m.question && !m.answered && m.from === "manager");
  const [pick, setPick] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, Toast } = useToast();
  return (
    <div className="card">
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <span className="small muted">{stepOf(s, f).label} · {ago(f.at)}</span>
        <span className={`chip ${st.tone}`}><span className="dot" /> {st.label}{f.ticketId ? ` · ${f.ticketId}` : ""}</span>
      </div>
      <div className="quote" style={{ marginTop: 8 }}>{f.text}</div>
      <div className="stack-sm" style={{ marginTop: 10 }}>
        {f.messages.map((m) => (
          <div key={m.id} className={`msg ${m.from}`}>
            <div className="from">{m.from === "heard" ? "Heard" : m.from === "manager" ? s.manager.split(" (")[0] : "You"} · {ago(m.at)}</div>
            {m.text}
          </div>
        ))}
      </div>
      {open && (
        <div className="card flat" style={{ marginTop: 10 }}>
          <div className="row wrap">
            {(open.options ?? []).map((o) => (
              <button key={o} className={`option ${pick === o ? "sel" : ""}`} onClick={() => setPick(pick === o ? null : o)}>{o}</button>
            ))}
          </div>
          <input type="text" style={{ marginTop: 8 }} placeholder="Anything else? (optional)" value={extra} onChange={(e) => setExtra(e.target.value)} />
          <button
            className="btn primary"
            style={{ marginTop: 8 }}
            disabled={busy || (!pick && !extra.trim())}
            onClick={async () => {
              setBusy(true);
              try {
                await post("/api/reply", { feedbackId: f.id, text: [pick, extra.trim()].filter(Boolean).join(" — ") });
                await refresh();
                toast("Sent — thank you.");
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Send answer"}
          </button>
        </div>
      )}
      <Toast />
    </div>
  );
}
