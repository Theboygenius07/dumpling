"use client";
import { useState } from "react";
import type { Ticket } from "@/lib/types";
import { Avatar, Loading, SEV_TONE, ago, fbOf, stepOf, testerOf, useStore, useToast, type State } from "../ui";

export default function TicketsPage() {
  const { s, empty } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  if (!s) return <Loading empty={empty} />;
  const tickets = [...s.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const t = tickets.find((x) => x.id === sel) ?? tickets[0];
  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow">For the developer</div>
        <h1 style={{ marginTop: 4 }}>Tickets</h1>
        <p className="lede">Every ticket here was approved by a person, one at a time. Each one carries every tester who saw it, on what setup, in their own words.</p>
      </div>
      {!tickets.length ? (
        <div className="card empty">No tickets yet — they appear here when a manager approves one in Review.</div>
      ) : (
        <div className="split">
          <aside className="list sticky">
            {tickets.map((x) => (
              <button key={x.id} className={`item ${t?.id === x.id ? "on" : ""}`} onClick={() => setSel(x.id)}>
                <div className="row wrap"><span className="chip ink">{x.id}</span><span className={`chip ${SEV_TONE[x.severity]}`}>{x.severity}</span><span className="chip line">{x.witnessIds.length} {x.witnessIds.length === 1 ? "witness" : "witnesses"}</span></div>
                <div className="t">{x.title}</div>
              </button>
            ))}
          </aside>
          {t && <TicketView s={s} t={t} />}
        </div>
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
    "### Seen by",
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

function TicketView({ s, t }: { s: State; t: Ticket }) {
  const { toast, Toast } = useToast();
  const w = t.witnessIds.map((id) => fbOf(s, id)!).filter(Boolean);
  const browsers = [...new Set(w.map((f) => testerOf(s, f.testerId)?.env.browser.split(" ")[0]))];
  return (
    <section className="stack">
      <div className="card stack">
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <div className="row wrap"><span className="chip ink">{t.id}</span><span className={`chip ${SEV_TONE[t.severity]}`}>{t.severity}</span><span className="chip good">{t.status}</span></div>
          <button className="btn sm" onClick={async () => { await navigator.clipboard.writeText(markdown(s, t)); toast("Copied — paste into GitHub or Jira."); }}>Copy for GitHub / Jira</button>
        </div>
        <h1 style={{ fontSize: 26 }}>{t.title}</h1>
        <p className="small muted">
          Drafted by {t.draftedBy === "model" ? "Heard" : "rules"} · approved by {t.approvedBy} {ago(t.createdAt)}
          {t.edited.length ? ` · the manager changed: ${t.edited.join(", ")}` : " · approved as drafted"}
        </p>
        <p className="small"><b>Why {t.severity}:</b> {t.severityWhy}</p>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Steps to reproduce</h3>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>{t.steps.map((x, i) => <li key={i} style={{ marginTop: 4 }}>{x}</li>)}</ol>
        </div>
        <div className="card stack-sm">
          <div><div className="small muted">Expected</div><p>{t.expected}</p></div>
          <div><div className="small muted">What happened</div><p>{t.actual}</p></div>
          {t.notes && <div><div className="small muted">Notes</div><p>{t.notes}</p></div>}
        </div>
      </div>
      <div className="card">
        <div className="panel-title"><h3>Seen by {w.length} {w.length === 1 ? "tester" : "testers"}</h3><span className="small muted">{browsers.join(" · ")}</span></div>
        <div className="stack">
          {w.map((f) => {
            const p = testerOf(s, f.testerId);
            return (
              <div key={f.id} className="row" style={{ alignItems: "flex-start" }}>
                <Avatar t={p} />
                <div className="grow">
                  <div className="small"><b>{p?.name}</b> <span className="muted">· {p?.env.browser} · {p?.env.os} · {p?.env.device} · {stepOf(s, f).label}</span></div>
                  <div className="quote" style={{ marginTop: 4 }}>{f.text}</div>
                  {f.messages.filter((m) => m.from === "tester").map((m) => <p key={m.id} className="small" style={{ marginTop: 4 }}><span className="muted">Follow-up:</span> {m.text}</p>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Toast />
    </section>
  );
}
