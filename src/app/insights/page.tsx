"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Avatar, Dots, useStore } from "../ui";

// Outcome colours: validated as a categorical set against the dark surface (CVD + normal-vision separation), in this order.
const OUT = [
  { key: "ticketed", label: "Became tickets", color: "#36A06A" },
  { key: "idea", label: "In ideas backlog", color: "#8E7CF0" },
  { key: "asked", label: "Question with tester", color: "#C97624" },
  { key: "answered", label: "Answered or thanked", color: "#CF5A8C" },
] as const;

export default function InsightsPage() {
  const { s, refresh, toast } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  if (!s) return <div className="page empty"><Dots /></div>;

  const notes = s.feedback;
  const isBug = (k?: string) => k === "bug" || k === "unclear";
  const bugNotes = notes.filter((f) => isBug(f.analysis?.kind));
  const problems = s.groups.filter((g) => g.memberIds.some((id) => isBug(notes.find((f) => f.id === id)?.analysis?.kind))).length;
  const replied = notes.filter((f) => f.messages.some((m) => m.from === "manager")).length;
  const counts = {
    ticketed: notes.filter((f) => f.status === "ticketed").length,
    idea: notes.filter((f) => f.status === "idea").length,
    asked: notes.filter((f) => f.status === "asked").length,
    answered: notes.filter((f) => f.status === "answered" || f.status === "thanked").length,
  };
  const waiting = notes.filter((f) => f.status === "new").length;

  const judged = s.decisions.filter((d) => ["create-ticket", "split", "join", "file-idea", "set-kind"].includes(d.action));
  const agreed = judged.filter((d) => !d.overruled).length;
  const overruled = s.decisions.filter((d) => d.overruled);

  const heat = s.scripts.map((sc) => ({ sc, steps: sc.steps.map((st) => ({ st, n: notes.filter((f) => f.stepId === st.id && f.verdict !== "worked" && f.analysis?.kind !== "idea").length })) }));
  const maxHeat = Math.max(1, ...heat.flatMap((h) => h.steps.map((x) => x.n)));
  const hot = heat.flatMap((h) => h.steps.map((x) => ({ ...x, sc: h.sc }))).sort((a, b) => b.n - a.n)[0];

  const browsers = new Map<string, number>();
  for (const f of bugNotes) { const b = s.testers.find((t) => t.id === f.testerId)?.env.browser.split(" ")[0] ?? "?"; browsers.set(b, (browsers.get(b) ?? 0) + 1); }
  const maxB = Math.max(1, ...browsers.values());

  async function run(what: "reset" | "import") {
    setBusy(what);
    try {
      const r = await fetch(what === "reset" ? "/api/seed" : "/api/import-chalk", { method: "POST" }).then((r) => r.json());
      await refresh();
      toast(what === "reset" ? "Demo reset to the start of the cycle." : r.imported ? `Imported ${r.imported} report${r.imported > 1 ? "s" : ""} from chalk.` : r.message ?? "Nothing new from chalk.");
    } finally { setBusy(null); }
  }

  return (
    <div className="page stack-16">
      <div className="head" style={{ marginBottom: 6 }}>
        <div>
          <div className="eyebrow">Testing {s.cycle.product}</div>
          <h1 style={{ marginTop: 6 }}>{s.cycle.name}</h1>
          <p>Testers say what went wrong in their own words. Dumpling turns it into one case per problem and shows its working. A person decides every step, and every tester hears back.</p>
        </div>
        <div className="row">
          {s.workspace === "ws_chalk" && <button className="btn ghost" disabled={!!busy} onClick={() => run("reset")}>{busy === "reset" ? <Dots /> : <RotateCcw size={15} />}Reset demo</button>}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="label">Notes from testers</div><div className="v">{notes.length}</div><div className="d">from {new Set(notes.map((f) => f.testerId)).size} testers, in their own words</div></div>
        <div className="kpi"><div className="label">Distinct problems</div><div className="v">{problems}</div><div className="d">{bugNotes.length} bug notes folded into {problems} — duplicates became witnesses</div></div>
        <div className="kpi"><div className="label">Tickets</div><div className="v">{s.tickets.length}</div><div className="d">each approved by a person, one at a time</div></div>
        <div className="kpi"><div className="label">Dumpling back from a person</div><div className="v">{replied}<small>/{notes.length}</small></div><div className="d">{waiting} notes still waiting for a decision</div></div>
      </div>

      <div className="grid-2">
        <div className="panel pad">
          <div className="row between"><h3>Where every note went</h3><span className="small muted">{notes.length - waiting} of {notes.length} decided</span></div>
          <div className="flow" style={{ marginTop: 18, background: "var(--hover)" }} role="img" aria-label="Note outcomes">
            {OUT.map((o) => counts[o.key] > 0 && <i key={o.key} title={`${o.label}: ${counts[o.key]}`} style={{ width: `${(counts[o.key] / notes.length) * 100}%`, background: o.color }} />)}
          </div>
          <div className="legend" style={{ marginTop: 14 }}>
            {OUT.map((o) => <span key={o.key}><i style={{ background: o.color }} />{o.label} <b style={{ fontWeight: 600, color: "var(--ink)" }}>{counts[o.key]}</b></span>)}
            <span><i style={{ background: "var(--border-3)" }} />Waiting for review <b style={{ fontWeight: 600, color: "var(--ink)" }}>{waiting}</b></span>
          </div>
          <div className="hr" style={{ margin: "18px 0" }} />
          <div className="row between"><h3>Did every tester hear back?</h3></div>
          <div className="stack-6" style={{ marginTop: 12 }}>
            {s.testers.filter((t) => notes.some((f) => f.testerId === t.id)).map((t) => {
              const mine = notes.filter((f) => f.testerId === t.id);
              const r = mine.filter((f) => f.messages.some((m) => m.from === "manager")).length;
              return (
                <div key={t.id} className="hbar" style={{ gridTemplateColumns: "150px 1fr 40px" }} title={`${t.name}: ${r} of ${mine.length} notes have a reply from a person`}>
                  <span className="row" style={{ gap: 8 }}><Avatar t={t} size="sm" /><span className="clip">{t.name.split(" ")[0]}</span></span>
                  <span className="tr"><i style={{ width: `${(r / mine.length) * 100}%`, background: "var(--green)" }} /></span>
                  <span className="muted" style={{ textAlign: "right" }}>{r}/{mine.length}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel pad">
          <div className="row between"><h3>Is Dumpling’s judgement any good?</h3></div>
          {judged.length ? (
            <>
              <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: 14 }}>
                <span style={{ font: "500 44px/1 var(--head)", letterSpacing: "-0.04em" }}>{Math.round((agreed / judged.length) * 100)}%</span>
                <span className="muted">of calls the manager agreed with ({agreed} of {judged.length})</span>
              </div>
              <div className="stack" style={{ marginTop: 16 }}>
                {overruled.slice(-4).reverse().map((d) => (
                  <div key={d.id} className="well small" style={{ padding: "10px 12px" }}>
                    <span className="pill warn" style={{ height: 20, marginRight: 8 }}>Overruled</span>
                    Dumpling said <b style={{ fontWeight: 500 }}>{d.aiSaid}</b> → {d.by.split(" (")[0]} said <b style={{ fontWeight: 500 }}>{d.humanSaid}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted small" style={{ marginTop: 12 }}>No decisions yet. Each time the manager agrees with or overrules Dumpling it’s counted here — so trust in the tool is earned, not assumed. <Link className="link" href="/review">Start reviewing</Link></p>
          )}
          <p className="small muted" style={{ marginTop: 14 }}>Every overrule is kept. It shows the team where to trust Dumpling, and where not to.</p>
          <div className="hr" style={{ margin: "18px 0" }} />
          <h3>Bug notes by browser</h3>
          <div className="stack-6" style={{ marginTop: 12 }}>
            {[...browsers.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => (
              <div key={b} className="hbar" title={`${b}: ${n} bug notes`}>
                <span>{b}</span>
                <span className="tr"><i style={{ width: `${(n / maxB) * 100}%`, background: "var(--accent)" }} /></span>
                <span className="muted" style={{ textAlign: "right" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel pad">
        <div className="row between">
          <h3>Where testing hurts</h3>
          {hot && hot.n > 0 && <span className="small muted">Hottest: {hot.sc.title}, step {hot.st.n} — {hot.n} notes</span>}
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>Notes per script step that didn’t simply work. Darker means more.</p>
        <div className="grid-3" style={{ marginTop: 16 }}>
          {heat.map(({ sc, steps }) => (
            <div key={sc.id}>
              <div className="small" style={{ fontWeight: 500, marginBottom: 8 }}>{sc.title}</div>
              <div className="heat" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
                {steps.map(({ st, n }) => {
                  const a = n / maxHeat;
                  return (
                    <div key={st.id} className="cell" title={`Step ${st.n}: ${st.action} — ${n} ${n === 1 ? "note" : "notes"}`}
                      style={{ background: n ? `rgba(235, 87, 87, ${0.14 + a * 0.76})` : "var(--hover)", color: "var(--text)", boxShadow: n ? "none" : "inset 0 0 0 1px var(--border)" }}>
                      <span style={{ opacity: 0.8 }}>{st.n}</span>
                      <b style={{ fontSize: 15, fontWeight: 600 }}>{n}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
