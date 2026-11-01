"use client";
import { useEffect, useState } from "react";
import { Check, ListChecks, Plus, Settings2, Trash2, UserPlus, Users } from "lucide-react";
import type { Script } from "@/lib/types";
import { Avatar, Dots, Empty, post, useStore, type State } from "../ui";

type Tab = "workspace" | "people" | "scripts";

export default function SettingsPage() {
  const { s } = useStore();
  const [tab, setTab] = useState<Tab>("workspace");
  // Read the tab from the URL without useSearchParams, so the page stays statically renderable.
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t === "people" || t === "scripts" || t === "workspace") setTab(t);
  }, []);
  if (!s) return <div className="page empty"><Dots /></div>;
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `/settings?tab=${t}`); };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p>Everything about the {s.cycle.product} workspace: the product, the people testing it, and the scripts they run.</p>
        </div>
      </div>
      <div className="seg" style={{ maxWidth: 420, marginBottom: 18 }} role="tablist">
        <button role="tab" aria-selected={tab === "workspace"} className={tab === "workspace" ? "on" : ""} onClick={() => go("workspace")}><Settings2 size={13} />Workspace</button>
        <button role="tab" aria-selected={tab === "people"} className={tab === "people" ? "on" : ""} onClick={() => go("people")}><Users size={13} />People · {s.testers.filter((t) => t.id.startsWith("t_")).length}</button>
        <button role="tab" aria-selected={tab === "scripts"} className={tab === "scripts" ? "on" : ""} onClick={() => go("scripts")}><ListChecks size={13} />Test scripts · {s.scripts.length}</button>
      </div>
      {tab === "workspace" && <WorkspaceTab s={s} />}
      {tab === "people" && <PeopleTab s={s} />}
      {tab === "scripts" && <ScriptsTab key={s.workspace} s={s} />}
    </div>
  );
}

function WorkspaceTab({ s }: { s: State }) {
  const { refresh, toast } = useStore();
  const [f, setF] = useState({ product: s.cycle.product, productAbout: s.cycle.productAbout ?? "", ticketPrefix: s.cycle.ticketPrefix ?? "", productUrl: s.cycle.productUrl, name: s.cycle.name, manager: s.manager.split(" (")[0] ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const prefix = (f.ticketPrefix || "T").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "T";
  return (
    <div className="panel pad stack-16">
      <div className="grid-2">
        <label className="field"><span className="label">Product name</span><input className="input" value={f.product} onChange={set("product")} /></label>
        <label className="field"><span className="label">Ticket prefix</span><input className="input" value={f.ticketPrefix} onChange={set("ticketPrefix")} placeholder="CH" /></label>
      </div>
      <label className="field"><span className="label">What it is, in a few words</span><input className="input" value={f.productAbout} onChange={set("productAbout")} placeholder="an AI teaching whiteboard" /></label>
      <label className="field"><span className="label">Where testers open it</span><input className="input" value={f.productUrl} onChange={set("productUrl")} /></label>
      <div className="grid-2">
        <label className="field"><span className="label">Test cycle</span><input className="input" value={f.name} onChange={set("name")} /></label>
        <label className="field"><span className="label">UAT manager</span><input className="input" value={f.manager} onChange={set("manager")} /></label>
      </div>
      <div className="well small" style={{ padding: "10px 12px", color: "var(--text-2)" }}>
        Dumpling reads notes as feedback on <b style={{ color: "var(--text)", fontWeight: 500 }}>{f.product || "your product"}{f.productAbout ? `, ${f.productAbout}` : ""}</b>. The next ticket will be <b style={{ color: "var(--text)", fontWeight: 500 }}>{prefix}-{s.nextTicket}</b>.
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn primary" disabled={busy || !f.product.trim()} onClick={async () => {
          setBusy(true);
          try { await post("/api/workspace", f); await refresh(); toast("Workspace saved."); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? <Dots /> : <Check size={14} />}Save</button>
      </div>
    </div>
  );
}

function PeopleTab({ s }: { s: State }) {
  const { refresh, toast } = useStore();
  const [f, setF] = useState({ name: "", browser: "", os: "", device: "" });
  const [busy, setBusy] = useState(false);
  const people = s.testers.filter((t) => t.id.startsWith("t_"));
  const fromApp = s.testers.filter((t) => !t.id.startsWith("t_"));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const notes = (id: string) => s.feedback.filter((x) => x.testerId === id).length;

  async function act(body: object, done: string) {
    setBusy(true);
    try { await post("/api/people", body); await refresh(); toast(done); return true; } catch (e) { toast((e as Error).message); return false; } finally { setBusy(false); }
  }

  return (
    <div className="stack-16">
      <div className="panel">
        <div className="lhead" style={{ borderRadius: "10px 10px 0 0" }}><Users size={13} />Testers<span className="muted" style={{ fontWeight: 400 }}>{people.length}</span></div>
        {!people.length && <Empty icon={<UserPlus size={18} />} title="No testers yet">Add the people who’ll run your test scripts. Their setup is attached to every note they send, so they never have to type it.</Empty>}
        {people.map((t) => (
          <div key={t.id} className="src-row" style={{ gridTemplateColumns: "28px 1fr auto auto" }}>
            <Avatar t={t} />
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{t.name}</div><div className="small muted clip">{t.env.browser} · {t.env.os} · {t.env.device}</div></div>
            <span className="small muted">{notes(t.id)} {notes(t.id) === 1 ? "note" : "notes"}</span>
            <button className="icon-btn" title={notes(t.id) ? "They’ve sent notes, so they stay on the record" : "Remove"} disabled={busy || notes(t.id) > 0} onClick={() => act({ action: "remove", id: t.id }, `${t.name} removed.`)} aria-label={`Remove ${t.name}`}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="panel pad stack">
        <h3>Add a tester</h3>
        <div className="grid-2">
          <label className="field"><span className="label">Name</span><input className="input" value={f.name} onChange={set("name")} placeholder="Grace Mensah" /></label>
          <label className="field"><span className="label">Browser</span><input className="input" value={f.browser} onChange={set("browser")} placeholder="Safari 26" /></label>
          <label className="field"><span className="label">Operating system</span><input className="input" value={f.os} onChange={set("os")} placeholder="macOS 26" /></label>
          <label className="field"><span className="label">Device</span><input className="input" value={f.device} onChange={set("device")} placeholder="MacBook Air" /></label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn primary" disabled={busy || !f.name.trim()} onClick={async () => { if (await act({ action: "add", ...f }, `${f.name} added.`)) setF({ name: "", browser: "", os: "", device: "" }); }}><UserPlus size={14} />Add tester</button>
        </div>
      </div>
      {fromApp.length > 0 && <p className="small muted">{fromApp.length} {fromApp.length === 1 ? "person has" : "people have"} also sent feedback from inside your app. They appear on their notes, not here.</p>}
    </div>
  );
}

type Draft = { id?: string; title: string; area: string; steps: { id?: string; action: string; expected: string }[] };

function ScriptsTab({ s }: { s: State }) {
  const { refresh, toast } = useStore();
  const [list, setList] = useState<Draft[]>(() => s.scripts.map((x: Script) => ({ id: x.id, title: x.title, area: x.area, steps: x.steps.map((st) => ({ id: st.id, action: st.action, expected: st.expected })) })));
  const [busy, setBusy] = useState(false);
  const edit = (i: number, d: Partial<Draft>) => setList(list.map((x, j) => (j === i ? { ...x, ...d } : x)));
  const editStep = (i: number, k: number, d: Partial<Draft["steps"][number]>) => edit(i, { steps: list[i]!.steps.map((st, j) => (j === k ? { ...st, ...d } : st)) });

  return (
    <div className="stack-16">
      {!list.length && <div className="panel"><Empty icon={<ListChecks size={18} />} title="No test scripts yet">A script is what testers follow: a few steps, each with what should happen. Add one below.</Empty></div>}
      {list.map((x, i) => (
        <div key={x.id ?? `new-${i}`} className="panel pad stack">
          <div className="grid-2" style={{ gridTemplateColumns: "1fr 200px" }}>
            <label className="field"><span className="label">Script</span><input className="input" value={x.title} onChange={(e) => edit(i, { title: e.target.value })} placeholder="Sign up and create a project" /></label>
            <label className="field"><span className="label">Area</span><input className="input" value={x.area} onChange={(e) => edit(i, { area: e.target.value })} placeholder="Onboarding" /></label>
          </div>
          <div className="stack-6">
            {x.steps.map((st, k) => (
              <div key={st.id ?? `s-${k}`} className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                <span className="snum" style={{ marginTop: 5 }}>{k + 1}</span>
                <input className="input" value={st.action} onChange={(e) => editStep(i, k, { action: e.target.value })} placeholder="What the tester does" />
                <input className="input" value={st.expected} onChange={(e) => editStep(i, k, { expected: e.target.value })} placeholder="What should happen" />
                <button className="icon-btn" style={{ marginTop: 2 }} onClick={() => edit(i, { steps: x.steps.filter((_, j) => j !== k) })} aria-label="Remove step"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn sm" onClick={() => edit(i, { steps: [...x.steps, { action: "", expected: "" }] })}><Plus size={13} />Add step</button>
            <span className="spacer" />
            <button className="btn ghost sm" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 size={13} />Remove script</button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn" onClick={() => setList([...list, { title: "", area: "", steps: [{ action: "", expected: "" }] }])}><Plus size={14} />Add a script</button>
        <span className="spacer" />
        <button className="btn primary" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await post("/api/scripts", { scripts: list }); await refresh(); toast("Scripts saved — testers see them now."); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? <Dots /> : <Check size={14} />}Save scripts</button>
      </div>
    </div>
  );
}
