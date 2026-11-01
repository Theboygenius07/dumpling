"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Sparkles, Ticket as TicketIcon } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { Avatar, Dots, Empty, Priority, SEV, Status, ago, fbOf, stepOf, testerOf, useStore, type State } from "../ui";

export default function TicketsPage() {
  const { s } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  if (!s) return <div className="page empty"><Dots /></div>;
  const tickets = [...s.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const t = tickets.find((x) => x.id === sel) ?? tickets[0];
  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>Tickets</h1>
          <p>Each one approved by a person, one at a time — with every tester who saw it, their setup and their exact words.</p>
        </div>
      </div>
      {!tickets.length ? (
        <div className="panel"><Empty icon={<TicketIcon size={20} />} title="No tickets yet">Tickets appear here when the UAT manager approves one. <Link href="/review" className="link">Go to Review</Link></Empty></div>
      ) : (
        <>
          <div className="list">
            <div className="lhead"><Status kind="todo" />Open<span className="muted" style={{ fontWeight: 400 }}>{tickets.length}</span></div>
            {tickets.map((x) => (
              <button key={x.id} className={`lrow ${t?.id === x.id ? "on" : ""}`} onClick={() => setSel(x.id)}>
                <Priority sev={x.severity} />
                <span className="small muted" style={{ fontWeight: 500 }}>{x.id}</span>
                <Status kind="todo" />
                <span className="clip" style={{ fontWeight: 500 }}>{x.title}</span>
                <span className="avatars">{x.witnessIds.slice(0, 6).map((id) => <Avatar key={id} t={testerOf(s, fbOf(s, id)?.testerId ?? "")} size="sm" />)}</span>
                <span className="small muted" style={{ textAlign: "right" }}>{ago(x.createdAt)}</span>
              </button>
            ))}
          </div>
          {t && <Issue key={t.id} s={s} t={t} />}
        </>
      )}
    </div>
  );
}

function markdown(s: State, t: Ticket) {
  const w = t.witnessIds.map((id) => fbOf(s, id)!).filter(Boolean);
  return [
    `## ${t.id}: ${t.title}`,
    `**Severity:** ${t.severity} — ${t.severityWhy}`,
    "",
    "### Steps to reproduce",
    ...t.steps.map((x, i) => `${i + 1}. ${x}`),
    "",
    `**Expected:** ${t.expected}`,
    `**Actual:** ${t.actual}`,
    "",
    `### Seen by ${w.length} ${w.length === 1 ? "tester" : "testers"}`,
    "| Tester | Browser | OS | Device | Their words |",
    "|---|---|---|---|---|",
    ...w.map((f) => {
      const p = testerOf(s, f.testerId);
      return `| ${p?.name} | ${p?.env.browser} | ${p?.env.os} | ${p?.env.device} | “${f.text.replace(/\|/g, "/")}” |`;
    }),
    "",
    t.notes ? `**Notes:** ${t.notes}` : "",
    "",
    `_From UAT (${s.cycle.name}). Drafted by Heard, approved by ${t.approvedBy}${t.edited.length ? `, who edited: ${t.edited.join(", ")}` : ""}._`,
  ].join("\n");
}

function Issue({ s, t }: { s: State; t: Ticket }) {
  const { toast } = useStore();
  const [copied, setCopied] = useState(false);
  const w = t.witnessIds.map((id) => fbOf(s, id)!).filter(Boolean);
  const browsers = [...new Set(w.map((f) => testerOf(s, f.testerId)?.env.browser))];
  const step = w[0] ? stepOf(s, w[0]) : null;
  const manager = t.approvedBy.split(" (")[0]!;
  return (
    <div className="issue" style={{ animation: "fade 180ms" }}>
      <section className="issue-body stack-16">
        <div className="row between">
          <span className="small muted" style={{ fontWeight: 500 }}>{t.id}</span>
          <button className="btn sm" onClick={async () => { await navigator.clipboard.writeText(markdown(s, t)); setCopied(true); toast("Copied — paste into GitHub or Jira."); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}Copy for GitHub / Jira
          </button>
        </div>
        <h1>{t.title}</h1>
        <div>
          <h3 style={{ marginBottom: 10 }}>Steps to reproduce</h3>
          <ol className="ol">{t.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </div>
        <div className="ea">
          <div><div className="label" style={{ color: "var(--good)" }}>Expected</div><p style={{ marginTop: 3 }}>{t.expected}</p></div>
          <div><div className="label" style={{ color: "var(--bug)" }}>What happened</div><p style={{ marginTop: 3 }}>{t.actual}</p></div>
        </div>
        {t.notes && <div><h3 style={{ marginBottom: 6 }}>Notes</h3><p style={{ color: "var(--text-2)" }}>{t.notes}</p></div>}
        <div className="hr" />
        <div>
          <h3 style={{ marginBottom: 14 }}>Activity</h3>
          <div className="activity">
            {w.map((f) => {
              const p = testerOf(s, f.testerId);
              return (
                <div key={f.id} className="act-row">
                  <Avatar t={p} />
                  <div>
                    <div className="small"><b style={{ fontWeight: 500 }}>{p?.name}</b> <span className="muted">reported it · {p?.env.browser} · {p?.env.os} · {p?.env.device} · {ago(f.at)}</span></div>
                    <div className="quote" style={{ marginTop: 6 }}>{f.text}</div>
                    {f.messages.filter((m) => m.from === "tester").map((m) => <p key={m.id} className="small" style={{ marginTop: 6 }}><span className="muted">Follow-up:</span> {m.text}</p>)}
                  </div>
                </div>
              );
            })}
            <div className="act-row">
              <span className="hmark" style={{ width: 26, height: 26, borderRadius: "50%" }}><Sparkles size={13} /></span>
              <div className="small" style={{ paddingTop: 4 }}><b style={{ fontWeight: 500 }}>Heard</b> <span className="muted">drafted this ticket from {w.length} {w.length === 1 ? "report" : "reports"}</span></div>
            </div>
            <div className="act-row">
              <Avatar t={{ name: manager }} />
              <div className="small" style={{ paddingTop: 4 }}><b style={{ fontWeight: 500 }}>{manager}</b> <span className="muted">approved it{t.edited.length ? ` and changed the ${t.edited.join(", ")}` : " as drafted"} · {ago(t.createdAt)}</span></div>
            </div>
          </div>
        </div>
      </section>
      <aside className="issue-side">
        <div className="prop"><span>Status</span><span className="row"><Status kind="todo" />Open</span></div>
        <div className="prop"><span>Priority</span><span className="row"><Priority sev={t.severity} />{SEV[t.severity].label}</span></div>
        <div className="prop" style={{ alignItems: "start" }}><span>Why</span><span className="small" style={{ color: "var(--text-2)" }}>{t.severityWhy}</span></div>
        <div className="hr" style={{ margin: "8px 0" }} />
        <div className="prop"><span>Reported by</span><span className="row"><span className="avatars">{w.slice(0, 5).map((f) => <Avatar key={f.id} t={testerOf(s, f.testerId)} size="sm" />)}</span>{w.length}</span></div>
        <div className="prop" style={{ alignItems: "start" }}><span>Seen on</span><span className="row wrap" style={{ gap: 4 }}>{browsers.map((b) => <span key={b} className="pill">{b}</span>)}</span></div>
        {step?.script && <div className="prop" style={{ alignItems: "start" }}><span>Found in</span><span className="small">{step.label}</span></div>}
        <div className="hr" style={{ margin: "8px 0" }} />
        <div className="prop"><span>Approved by</span><span className="row"><Avatar t={{ name: manager }} size="sm" />{manager}</span></div>
        <div className="prop"><span>Drafted by</span><span className="row"><Sparkles size={13} color="var(--accent)" />Heard</span></div>
      </aside>
    </div>
  );
}
