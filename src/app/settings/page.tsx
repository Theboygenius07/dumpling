"use client";
import { useEffect, useState } from "react";
import { Check, ExternalLink, ListChecks, Plug, Plus, Settings2, Trash2, UserPlus, Users } from "lucide-react";
import type { Script } from "@/lib/types";
import { Avatar, Dots, Empty, post, useStore, type State } from "../ui";

type Tab = "workspace" | "people" | "scripts" | "integrations";
const TABS: Tab[] = ["workspace", "people", "scripts", "integrations"];

export default function SettingsPage() {
  const { s } = useStore();
  const [tab, setTab] = useState<Tab>("workspace");
  // Read the tab from the URL without useSearchParams, so the page stays statically renderable.
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (TABS.includes(t as Tab)) setTab(t as Tab);
  }, []);
  if (!s) return <div className="page empty"><Dots /></div>;
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `/settings?tab=${t}`); };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p>Everything about the {s.cycle.product} workspace: the product, the people testing it, the scripts they run and where tickets go.</p>
        </div>
      </div>
      <div className="seg" style={{ maxWidth: 560, marginBottom: 18 }} role="tablist">
        <button role="tab" aria-selected={tab === "workspace"} className={tab === "workspace" ? "on" : ""} onClick={() => go("workspace")}><Settings2 size={13} />Workspace</button>
        <button role="tab" aria-selected={tab === "people"} className={tab === "people" ? "on" : ""} onClick={() => go("people")}><Users size={13} />People</button>
        <button role="tab" aria-selected={tab === "scripts"} className={tab === "scripts" ? "on" : ""} onClick={() => go("scripts")}><ListChecks size={13} />Test scripts · {s.scripts.length}</button>
        <button role="tab" aria-selected={tab === "integrations"} className={tab === "integrations" ? "on" : ""} onClick={() => go("integrations")}><Plug size={13} />Integrations</button>
      </div>
      {tab === "workspace" && <WorkspaceTab s={s} />}
      {tab === "people" && <PeopleTab s={s} />}
      {tab === "scripts" && <ScriptsTab key={s.workspace} s={s} />}
      {tab === "integrations" && <IntegrationsTab key={s.workspace} />}
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

type MemberRow = { id: string; name: string; email: string; role: "manager" | "tester" | "developer"; you: boolean };
type InviteRow = { token: string; email: string; role: string; createdAt: string };

function PeopleTab({ s }: { s: State }) {
  const { refresh, toast } = useStore();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRow["role"]>("tester");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const r = await fetch("/api/members").then((r) => r.json()).catch(() => null);
    if (r?.members) { setMembers(r.members); setInvites(r.invites); }
  };
  useEffect(() => { load(); }, [s.workspace]);
  const link = (token: string) => `${location.origin}/signup?invite=${token}`;

  async function act(body: object, done?: string) {
    setBusy(true);
    try {
      const r = await post<{ joined?: boolean; token?: string }>("/api/members", body);
      await load(); await refresh();
      if (r.token) { await navigator.clipboard.writeText(link(r.token)).catch(() => {}); toast("Invitation link copied — send it to them."); }
      else if (done) toast(done);
      return true;
    } catch (e) { toast((e as Error).message); return false; } finally { setBusy(false); }
  }

  return (
    <div className="stack-16">
      <div className="panel">
        <div className="lhead" style={{ borderRadius: "10px 10px 0 0" }}><Users size={13} />Members<span className="muted" style={{ fontWeight: 400 }}>{members.length}</span><span className="spacer" /><span className="small muted" style={{ fontWeight: 400 }}>Managers decide · testers test · developers fix</span></div>
        {members.map((m) => (
          <div key={m.id} className="src-row" style={{ gridTemplateColumns: "28px 1fr 150px auto" }}>
            <Avatar t={m} />
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{m.name}{m.you && <span className="muted" style={{ fontWeight: 400 }}> · you</span>}</div><div className="small muted clip">{m.email}</div></div>
            <select className="select" value={m.role} disabled={busy || m.you} onChange={(e) => act({ action: "role", userId: m.id, role: e.target.value }, `${m.name} is now a ${e.target.value}.`)} aria-label={`Role for ${m.name}`}>
              <option value="manager">Manager</option><option value="tester">Tester</option><option value="developer">Developer</option>
            </select>
            <button className="icon-btn" disabled={busy || m.you} title={m.you ? "Ask another manager to remove you" : "Remove from workspace"} onClick={() => confirm(`Remove ${m.name} from ${s.cycle.product}?`) && act({ action: "remove", userId: m.id }, `${m.name} removed.`)} aria-label={`Remove ${m.name}`}><Trash2 size={14} /></button>
          </div>
        ))}
        {invites.map((i) => (
          <div key={i.token} className="src-row" style={{ gridTemplateColumns: "28px 1fr 150px auto" }}>
            <span className="avatar" style={{ background: "var(--raise)", color: "var(--text-3)" }}><UserPlus size={13} /></span>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{i.email}</div><div className="small muted">Invited as {i.role} · waiting for them to sign up</div></div>
            <button className="btn sm" onClick={async () => { await navigator.clipboard.writeText(link(i.token)); toast("Invitation link copied."); }}>Copy link</button>
            <button className="icon-btn" disabled={busy} title="Withdraw invitation" onClick={() => act({ action: "revoke", token: i.token }, "Invitation withdrawn.")} aria-label="Withdraw invitation"><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="src-row" style={{ gridTemplateColumns: "28px 1fr 150px auto" }}>
          <span className="avatar" style={{ background: "var(--raise)", color: "var(--text-2)" }}><UserPlus size={13} /></span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email" />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as MemberRow["role"])} aria-label="Role"><option value="tester">Tester</option><option value="developer">Developer</option><option value="manager">Manager</option></select>
          <button className="btn primary sm" disabled={busy || !email.includes("@")} onClick={async () => { if (await act({ action: "invite", email, role }, "They already had an account — they’re in.")) setEmail(""); }}>Invite</button>
        </div>
      </div>
      <p className="small muted">People who already have an account join straight away. Everyone else gets a link to sign up; the invitation is tied to their email.</p>
      {s.demo && <SampleTesters s={s} />}
    </div>
  );
}

/** The demo's sample testers have no accounts; a manager acts as them to show the tester's side. */
function SampleTesters({ s }: { s: State }) {
  const { refresh, toast } = useStore();
  const [f, setF] = useState({ name: "", browser: "", os: "", device: "" });
  const [busy, setBusy] = useState(false);
  const samples = s.testers.filter((t) => !t.userId && t.id.startsWith("t_"));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const notes = (id: string) => s.feedback.filter((x) => x.testerId === id).length;
  async function act(body: object, done: string) {
    setBusy(true);
    try { await post("/api/people", body); await refresh(); toast(done); return true; } catch (e) { toast((e as Error).message); return false; } finally { setBusy(false); }
  }
  return (
    <div className="panel">
      <div className="lhead" style={{ borderRadius: "10px 10px 0 0" }}><Users size={13} />Sample testers (demo)<span className="muted" style={{ fontWeight: 400 }}>{samples.length}</span></div>
      {samples.map((t) => (
        <div key={t.id} className="src-row" style={{ gridTemplateColumns: "28px 1fr auto auto" }}>
          <Avatar t={t} />
          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{t.name}</div><div className="small muted clip">{t.env.browser} · {t.env.os} · {t.env.device}</div></div>
          <span className="small muted">{notes(t.id)} {notes(t.id) === 1 ? "note" : "notes"}</span>
          <button className="icon-btn" disabled={busy || notes(t.id) > 0} title={notes(t.id) ? "They’ve sent notes, so they stay on the record" : "Remove"} onClick={() => act({ action: "remove", id: t.id }, `${t.name} removed.`)} aria-label={`Remove ${t.name}`}><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="src-row" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}>
        <input className="input" value={f.name} onChange={set("name")} placeholder="Name" />
        <input className="input" value={f.browser} onChange={set("browser")} placeholder="Browser" />
        <input className="input" value={f.os} onChange={set("os")} placeholder="OS" />
        <input className="input" value={f.device} onChange={set("device")} placeholder="Device" />
        <button className="btn sm" disabled={busy || !f.name.trim()} onClick={async () => { if (await act({ action: "add", ...f }, `${f.name} added.`)) setF({ name: "", browser: "", os: "", device: "" }); }}>Add</button>
      </div>
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

// ---------- integrations ----------

type Pub = { github: { repo: string } | null; jira: { baseUrl: string; email: string; projectKey: string } | null };
type Field = { k: string; label: string; placeholder: string; secret?: boolean; help?: React.ReactNode };

const GITHUB_FIELDS: Field[] = [
  { k: "repo", label: "Repository", placeholder: "owner/repository" },
  { k: "token", label: "Token", placeholder: "github_pat_…", secret: true, help: <>A fine-grained token with <b>Issues: read and write</b> on that repository. <a className="link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Make one <ExternalLink size={11} /></a></> },
];
const JIRA_FIELDS: Field[] = [
  { k: "baseUrl", label: "Jira site", placeholder: "https://your-team.atlassian.net" },
  { k: "projectKey", label: "Project key", placeholder: "CH" },
  { k: "email", label: "Your Atlassian email", placeholder: "you@company.com" },
  { k: "token", label: "API token", placeholder: "ATATT…", secret: true, help: <>From your Atlassian account’s security settings. <a className="link" href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">Make one <ExternalLink size={11} /></a></> },
];

function IntegrationsTab() {
  const [pub, setPub] = useState<Pub | null>(null);
  const load = async () => setPub(await fetch("/api/integrations").then((r) => (r.ok ? r.json() : null)).catch(() => null));
  useEffect(() => { load(); }, []);
  if (!pub) return <div className="panel pad"><Dots /></div>;
  return (
    <div className="stack-16">
      <Connector target="github" title="GitHub" blurb="Each approved ticket becomes an issue, labelled uat and its severity." connected={pub.github && `Issues go to ${pub.github.repo}`} fields={GITHUB_FIELDS} onDone={load} />
      <Connector target="jira" title="Jira" blurb="Each approved ticket becomes a Bug in your project, with the steps and every tester’s words." connected={pub.jira && `Bugs go to ${pub.jira.projectKey} on ${pub.jira.baseUrl.replace(/^https?:\/\//, "")}`} fields={JIRA_FIELDS} onDone={load} />
      <p className="small muted">Tokens are encrypted before they’re stored and never sent back to a browser. Managers and developers can send an approved ticket; sending it twice never makes a second issue.</p>
    </div>
  );
}

function Connector({ target, title, blurb, connected, fields, onDone }: { target: "github" | "jira"; title: string; blurb: string; connected: string | null; fields: Field[]; onDone: () => Promise<void> }) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"test" | "save" | "remove" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const filled = fields.every((x) => (f[x.k] ?? "").trim());

  async function act(action: "test" | "save" | "remove") {
    setBusy(action); setMsg(null);
    try {
      const r = await post<{ message?: string }>("/api/integrations", { action, target, ...f });
      if (action === "test") setMsg({ ok: true, text: r.message ?? "It works." });
      else {
        toast(action === "save" ? (r.message ?? `${title} connected.`) : `${title} disconnected.`);
        setOpen(false); setF({});
        await onDone();
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(null); }
  }

  return (
    <div className="panel">
      <div className="src-row" style={{ gridTemplateColumns: "1fr auto" }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}><b style={{ fontWeight: 500 }}>{title}</b>{connected ? <span className="pill" style={{ color: "var(--good)" }}><Check size={11} />Connected</span> : <span className="pill">Not connected</span>}</div>
          <div className="small muted" style={{ marginTop: 2 }}>{connected ?? blurb}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {connected && <button className="btn sm" disabled={!!busy} onClick={() => confirm(`Disconnect ${title}? Tickets already sent stay where they are.`) && act("remove")}>{busy === "remove" ? <Dots /> : "Disconnect"}</button>}
          <button className={`btn sm ${connected ? "" : "primary"}`} onClick={() => { setOpen(!open); setMsg(null); }}>{open ? "Cancel" : connected ? "Change" : `Connect ${title}`}</button>
        </div>
      </div>
      {open && (
        <div className="pad stack-16" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="grid-2">
            {fields.map((x) => (
              <label key={x.k} className="field" style={x.help ? { gridColumn: "1 / -1" } : undefined}>
                <span className="label">{x.label}</span>
                <input className="input" type={x.secret ? "password" : "text"} autoComplete="off" spellCheck={false} value={f[x.k] ?? ""} placeholder={x.placeholder} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} />
                {x.help && <span className="small muted">{x.help}</span>}
              </label>
            ))}
          </div>
          {msg && <div className="well small" role="status" style={{ padding: "8px 12px", color: msg.ok ? "var(--good)" : "var(--bug)" }}>{msg.text}</div>}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" disabled={!filled || !!busy} onClick={() => act("test")}>{busy === "test" ? <Dots /> : "Test"}</button>
            <button className="btn primary" disabled={!filled || !!busy} onClick={() => act("save")}>{busy === "save" ? <Dots /> : <Check size={14} />}Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
