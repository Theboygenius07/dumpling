"use client";
import Link from "next/link";
import { useState } from "react";
import { Avatar, KIND, Loading, ago, testerOf, useStore, useToast } from "./ui";

export default function CyclePage() {
  const { s, empty, refresh } = useStore();
  const { toast, Toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!s) return <Loading empty={empty} />;

  const notes = s.feedback;
  const bugNotes = notes.filter((f) => f.analysis?.kind === "bug" || f.analysis?.kind === "unclear");
  const problems = s.groups.filter((g) => g.memberIds.some((id) => { const k = notes.find((f) => f.id === id)?.analysis?.kind; return k === "bug" || k === "unclear"; }));
  const decidedNotes = notes.filter((f) => f.status !== "new" && f.status !== "asked").length;
  const personReplied = notes.filter((f) => f.messages.some((m) => m.from === "manager")).length;
  const asked = notes.filter((f) => f.status === "asked").length;
  const overruled = s.decisions.filter((d) => d.overruled);
  const judged = s.decisions.filter((d) => ["create-ticket", "split", "join", "file-idea", "set-kind"].includes(d.action));
  const agreed = judged.filter((d) => !d.overruled).length;

  // Where the cycle hurts: notes per script step that didn't simply work.
  const heat = s.scripts.map((sc) => ({
    sc,
    steps: sc.steps.map((st) => ({ st, n: notes.filter((f) => f.stepId === st.id && f.verdict !== "worked" && f.analysis?.kind !== "idea").length })),
  }));
  const maxHeat = Math.max(1, ...heat.flatMap((h) => h.steps.map((x) => x.n)));

  const byBrowser = new Map<string, number>();
  for (const f of bugNotes) {
    const b = testerOf(s, f.testerId)?.env.browser.split(" ")[0] ?? "?";
    byBrowser.set(b, (byBrowser.get(b) ?? 0) + 1);
  }
  const kinds = (["bug", "idea", "question", "praise", "unclear"] as const).map((k) => ({ k, n: notes.filter((f) => f.analysis?.kind === k).length }));

  async function run(what: "reset" | "import") {
    setBusy(what);
    try {
      const r = await fetch(what === "reset" ? "/api/seed" : "/api/import-chalk", { method: "POST" }).then((r) => r.json());
      await refresh();
      toast(what === "reset" ? "Cycle reset." : r.imported ? `Imported ${r.imported} report${r.imported > 1 ? "s" : ""} from chalk.` : r.message ?? "Nothing new from chalk.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="row wrap" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Testing {s.cycle.product} · started {ago(s.cycle.startedAt)}</div>
          <h1 style={{ marginTop: 6, fontSize: 52 }}>{s.cycle.name}</h1>
          <p className="lede">Testers say what went wrong in their own words. Heard turns that into one ticket per problem, shows its working, and a person decides every step. Every tester hears back.</p>
        </div>
        <div className="row">
          <button className="btn" disabled={!!busy} onClick={() => run("import")}>{busy === "import" ? "Reading chalk…" : "Import chalk’s problem reports"}</button>
          <button className="btn quiet" disabled={!!busy} onClick={() => run("reset")}>{busy === "reset" ? "Resetting…" : "Reset demo"}</button>
        </div>
      </div>

      <div className="grid-4">
        <div className="stat"><div className="v">{notes.length}</div><div className="l">notes from {new Set(notes.map((f) => f.testerId)).size} testers</div></div>
        <div className="stat"><div className="v">{problems.length}</div><div className="l">distinct problems — {bugNotes.length} bug notes folded into {problems.length}</div></div>
        <div className="stat"><div className="v">{s.tickets.length}</div><div className="l">tickets, each approved by a person</div></div>
        <div className="stat"><div className="v">{decidedNotes}<span style={{ fontSize: 18, color: "var(--muted)" }}>/{notes.length}</span></div><div className="l">notes decided · {asked} waiting on a tester</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="panel-title"><h3>Where the cycle hurts</h3><span className="small muted">notes per step that didn’t just work</span></div>
          <div className="stack">
            {heat.map(({ sc, steps }) => (
              <div key={sc.id}>
                <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>{sc.title}</div>
                <div className="heat" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
                  {steps.map(({ st, n }) => {
                    const a = n / maxHeat;
                    return (
                      <div key={st.id} className="cell" title={st.action} style={{ background: n ? `rgba(228, 73, 42, ${0.12 + a * 0.88})` : "var(--sunk)", color: a > 0.55 ? "#fff" : "var(--ink)", boxShadow: n ? "none" : "inset 0 0 0 1px var(--line)" }}>
                        <span style={{ opacity: 0.75 }}>Step {st.n}</span>
                        <b style={{ fontSize: 16 }}>{n}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card stack">
          <div className="panel-title" style={{ marginBottom: 0 }}><h3>Is Heard’s judgement any good?</h3></div>
          {judged.length ? (
            <>
              <p><span style={{ font: "650 32px var(--head)" }}>{agreed}/{judged.length}</span> <span className="muted">times the manager agreed with Heard’s call</span></p>
              <div className="stack-sm">
                {overruled.slice(-4).reverse().map((d) => (
                  <div key={d.id} className="row small" style={{ alignItems: "flex-start" }}>
                    <span className="chip warn">overruled</span>
                    <span className="grow">Heard said <b>{d.aiSaid}</b> → {d.by.split(" (")[0]} said <b>{d.humanSaid}</b></span>
                  </div>
                ))}
              </div>
              <p className="small muted">Every overrule is kept. It is how a team learns where to trust the tool and where not to.</p>
            </>
          ) : (
            <p className="muted small">No decisions yet. Each time a manager agrees with or overrules Heard, it shows up here — so trust is earned, not assumed.</p>
          )}
          <div className="sep" style={{ margin: "4px 0" }} />
          <div className="row wrap">
            {kinds.filter((k) => k.n).map(({ k, n }) => <span key={k} className={`chip ${k}`}>{n} {KIND[k].toLowerCase()}{n > 1 && k !== "praise" && k !== "unclear" ? "s" : ""}</span>)}
          </div>
          <div className="row wrap small">
            <span className="muted">Bug notes by browser:</span>
            {[...byBrowser.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => <span key={b} className="chip line">{b} {n}</span>)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="panel-title"><h3>Did every tester feel heard?</h3><span className="small muted">{personReplied} of {notes.length} notes have a person’s reply</span></div>
          <div className="stack-sm">
            {s.testers.filter((t) => notes.some((f) => f.testerId === t.id)).map((t) => {
              const mine = notes.filter((f) => f.testerId === t.id);
              const replied = mine.filter((f) => f.messages.some((m) => m.from === "manager")).length;
              return (
                <div key={t.id} className="row">
                  <Avatar t={t} sm />
                  <span className="grow small"><b>{t.name}</b> <span className="muted">· {mine.length} notes</span></span>
                  <span className="meter"><span className="bar"><i style={{ width: `${(replied / mine.length) * 100}%`, background: "var(--good)" }} /></span><b>{replied}/{mine.length}</b></span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="panel-title"><h3>Decisions</h3><span className="small muted">every one by a person</span></div>
          {!s.decisions.length && <p className="muted small">None yet. <Link href="/review" style={{ textDecoration: "underline" }}>Start reviewing →</Link></p>}
          <div className="stack-sm">
            {[...s.decisions].reverse().slice(0, 8).map((d) => (
              <div key={d.id} className="row small" style={{ alignItems: "flex-start" }}>
                <span className={`chip ${d.overruled ? "warn" : "line"}`}>{d.action.replace("-", " ")}</span>
                <span className="grow">{d.humanSaid}</span>
                <span className="muted">{ago(d.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Toast />
    </div>
  );
}
