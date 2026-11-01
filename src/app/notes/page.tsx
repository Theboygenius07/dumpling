"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Inbox, MessageCircleQuestion, Send } from "lucide-react";
import type { Feedback } from "@/lib/types";
import { Avatar, Dots, Empty, DumplingMark, NOTE_ICON, NOTE_STATUS, Status, ago, post, stepOf, testerOf, useStore, type State } from "../ui";

export default function NotesPage() {
  const { s, testerId } = useStore();
  if (!s) return <div className="page empty"><Dots /></div>;
  return <Notes s={s} testerId={testerId} />;
}

function Notes({ s, testerId }: { s: State; testerId: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const tester = testerOf(s, testerId)!;
  // Most recent activity first: what changed since they last looked is what they came for.
  const last = (f: Feedback) => f.messages.reduce((m, x) => (x.at > m ? x.at : m), f.at);
  const mine = s.feedback.filter((f) => f.testerId === testerId).sort((a, b) => last(b).localeCompare(last(a)));
  const open = (f: Feedback) => f.messages.some((m) => m.question && !m.answered && m.from === "manager");
  const current = mine.find((f) => f.id === sel) ?? mine.find(open) ?? mine[0];
  // Pin whatever is showing, so answering a question doesn't swap the note out from under them.
  useEffect(() => { if (current && current.id !== sel) setSel(current.id); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tickets = mine.filter((f) => f.status === "ticketed").length;
  const replied = mine.filter((f) => f.messages.some((m) => m.from === "manager")).length;

  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>My notes</h1>
          <p>Every note is read by a person. Here’s where each of yours is — including the ones that didn’t become a ticket.</p>
        </div>
        {mine.length > 0 && <span className="small muted">{mine.length} sent · {tickets} became tickets · {replied} got a personal reply</span>}
      </div>
      {!mine.length ? (
        <div className="panel"><Empty icon={<Inbox size={20} />} title={`Nothing sent yet, ${tester.name.split(" ")[0]}`}>Run a test script and tell us how it went. Every note you send shows up here, with what happened to it. <Link className="link" href="/test">Start testing</Link></Empty></div>
      ) : (
        <div className="inbox">
          <div className="nlist">
            {mine.map((f) => {
              const st = NOTE_STATUS[f.status];
              return (
                <button key={f.id} className={`nrow ${current?.id === f.id ? "on" : ""}`} onClick={() => setSel(f.id)}>
                  <div className="row between">
                    <span className="row small" style={{ gap: 6, color: open(f) ? "var(--warn)" : "var(--text-2)", fontWeight: 500 }}><Status kind={NOTE_ICON[f.status]} />{st.label}{f.ticketId ? ` · ${f.ticketId}` : ""}</span>
                    <span className="small muted">{ago(last(f))}</span>
                  </div>
                  <div className="t clamp2">{f.text}</div>
                  <div className="small muted" style={{ marginTop: 3 }}>{stepOf(s, f).label}</div>
                </button>
              );
            })}
          </div>
          {current && <Note key={current.id} s={s} f={current} />}
        </div>
      )}
    </div>
  );
}

function stages(f: Feedback) {
  const outcome: Record<string, string> = { ticketed: `Ticket ${f.ticketId ?? ""}`, idea: "In the ideas backlog", answered: "Answered", thanked: "Passed to the team" };
  const decided = !!outcome[f.status];
  return [
    { label: "Sent", sub: "Received", state: "done" },
    { label: "Understood", sub: f.analysis ? "Dumpling read it" : "Reading…", state: f.analysis ? "done" : "now" },
    { label: "Reviewed", sub: f.status === "asked" ? "Question for you" : decided ? "By a person" : "Waiting for a person", state: decided ? "done" : "now" },
    { label: decided ? outcome[f.status]! : "Outcome", sub: decided ? "Decided" : "Not decided yet", state: decided ? "done" : "todo" },
  ];
}

function Note({ s, f }: { s: State; f: Feedback }) {
  const { refresh, toast } = useStore();
  const q = [...f.messages].reverse().find((m) => m.question && !m.answered && m.from === "manager");
  const [pick, setPick] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const manager = s.manager.split(" (")[0]!;
  const st = stepOf(s, f);

  async function answer() {
    setBusy(true);
    try {
      await post("/api/reply", { feedbackId: f.id, text: [pick, extra.trim()].filter(Boolean).join(" — ") });
      await refresh();
      toast("Sent — thank you.");
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="stack-16" style={{ padding: "18px 22px 24px", animation: "fade 180ms" }}>
      <div>
        <div className="small muted">{st.label} · {ago(f.at)}</div>
        <div className="quote" style={{ marginTop: 8, fontSize: 14.5 }}>{f.text}</div>
      </div>

      <div className="tracker">
        {stages(f).map((x) => (
          <div key={x.label} className={`tstep ${x.state}`}>
            <span className="tb" />
            <b>{x.label}</b>
            <span>{x.sub}</span>
          </div>
        ))}
      </div>

      {q && (
        <div className="ask stack">
          <div className="row"><MessageCircleQuestion size={17} /><b style={{ fontWeight: 500 }}>{manager} asked you something</b></div>
          <p style={{ fontSize: 15 }}>{q.text}</p>
          {!!q.options?.length && (
            <div className="row wrap" style={{ gap: 6 }}>
              {q.options.map((o) => <button key={o} className={`chipbtn ${pick === o ? "on" : ""}`} onClick={() => setPick(pick === o ? null : o)}>{o}</button>)}
            </div>
          )}
          <div className="row">
            <input className="input" placeholder="Anything else? (optional)" value={extra} onChange={(e) => setExtra(e.target.value)} />
            <button className="btn primary" disabled={busy || (!pick && !extra.trim())} onClick={answer}>{busy ? <Dots /> : <>Send <Send size={14} /></>}</button>
          </div>
        </div>
      )}

      <div>
        <div className="label" style={{ marginBottom: 10 }}>Conversation</div>
        <div className="stack">
          {f.messages.map((m) => {
            if (m.from === "tester") return (
              <div key={m.id} className="msg mine"><Avatar t={testerOf(s, f.testerId)} size="sm" /><div><div className="who"><b>You</b> · {ago(m.at)}</div><div className="bubble">{m.text}</div></div></div>
            );
            return (
              <div key={m.id} className={`msg ${m.from}`}>
                {m.from === "dumpling" ? <span className="hmark" style={{ width: 22, height: 22 }}><DumplingMark size={13} /></span> : <Avatar t={{ name: manager }} size="sm" />}
                <div><div className="who"><b>{m.from === "dumpling" ? "Dumpling" : manager}</b>{m.from === "manager" ? " · UAT manager" : ""} · {ago(m.at)}</div><div className="bubble">{m.text}</div></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
