"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChartColumn, Check, ChevronsUpDown, FlaskConical, Inbox, Lightbulb, ListChecks, LogOut, Plug, Plus, Settings, Ticket, UserPlus } from "lucide-react";
import { Avatar, Dots, DumplingMark, queue, useStore } from "./ui";

type Role = "tester" | "manager" | "developer" | "workspace";
type Area = Role;
type Item = { href: string; label: string; icon: React.ReactNode; role: Role; n?: number; hot?: boolean };

function roleOf(path: string): Role {
  if (path.startsWith("/test") || path.startsWith("/notes")) return "tester";
  if (path.startsWith("/tickets")) return "developer";
  if (path.startsWith("/connect") || path.startsWith("/settings") || path.startsWith("/workspaces")) return "workspace";
  return "manager";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const role = roleOf(path);
  const { s, empty, testerId } = useStore();
  // The voiceover recorder and the account pages are full-screen, outside the app frame.
  if (path === "/" || path.startsWith("/voice") || path.startsWith("/signin") || path.startsWith("/signup")) return <>{children}</>;
  // A fresh install has no workspace yet: welcome, except on the page that makes one.
  if (empty && !path.startsWith("/workspaces")) return <Welcome />;

  const mine = s?.feedback.filter((f) => f.testerId === testerId) ?? [];
  const questions = mine.filter((f) => f.messages.some((m) => m.question && !m.answered && m.from === "manager")).length;
  const waiting = s ? queue(s).length : 0;
  const ideas = s?.groups.filter((g) => g.status === "idea" || (g.status === "open" && s.feedback.find((f) => f.id === g.memberIds[0])?.analysis?.kind === "idea")).length ?? 0;
  const fromApps = s?.feedback.filter((f) => f.source !== "tester").length ?? 0;

  const groups: { label: string; items: Item[] }[] = [
    { label: "Tester", items: [
      { href: "/test", label: "Run tests", icon: <FlaskConical size={15} />, role: "tester" },
      { href: "/notes", label: "My notes", icon: <Inbox size={15} />, role: "tester", n: questions || mine.length, hot: questions > 0 },
    ] },
    { label: "UAT manager", items: [
      { href: "/review", label: "Review", icon: <ListChecks size={15} />, role: "manager", n: waiting, hot: waiting > 0 },
      { href: "/ideas", label: "Ideas", icon: <Lightbulb size={15} />, role: "manager", n: ideas },
      { href: "/insights", label: "Insights", icon: <ChartColumn size={15} />, role: "manager" },
    ] },
    { label: "Developer", items: [
      { href: "/tickets", label: "Tickets", icon: <Ticket size={15} />, role: "developer", n: s?.tickets.length ?? 0 },
    ] },
    { label: "Workspace", items: [
      { href: "/connect", label: "Connect your app", icon: <Plug size={15} />, role: "workspace", n: fromApps || undefined },
      { href: "/settings", label: "Settings", icon: <Settings size={15} />, role: "workspace" },
    ] },
  ];
  // The interface shows each role what it can use; the server enforces the same rules.
  const can: Record<string, Role[]> = { Tester: ["manager", "tester"], "UAT manager": ["manager"], Developer: ["manager", "developer"], Workspace: ["manager"] };
  const myRole = s?.me.role ?? "manager";
  const shown = groups.filter((g) => can[g.label]!.includes(myRole as Role));
  const here = groups.flatMap((g) => g.items).find((i) => path.startsWith(i.href));
  const areaRoles: Record<Area, Role[]> = { tester: ["manager", "tester"], manager: ["manager"], developer: ["manager", "developer"], workspace: ["manager"] };
  const allowed = !s || !here || areaRoles[here.role].includes(myRole as Role);

  return (
    <div className="app">
      <aside className="side">
        <Link href="/insights" className="ws"><span className="ws-mark"><DumplingMark size={15} /></span>Dumpling</Link>
        <WorkspaceSwitcher />
        {shown.map((g) => (
          <div key={g.label}>
            <div className="sgroup">{g.label}</div>
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className={`sitem ${path.startsWith(i.href) ? "on" : ""}`}>
                {i.icon}{i.label}
                {i.n != null && i.n > 0 && <span className={`n${i.hot ? " hot" : ""}`}>{i.n}</span>}
              </Link>
            ))}
          </div>
        ))}
        <div className="side-foot">{s?.demo && s.me.role === "manager" && <Persona />}<Account /></div>
      </aside>
      <div className="main">
        <header className="ph">
          <span className="crumb">{here?.icon}{here?.label ?? "Dumpling"}</span>
          <span className="spacer" />
          <Viewing role={role} />
        </header>
        <div className="content">
          {allowed ? children : (
            <div className="page panel"><div className="empty"><b style={{ color: "var(--text)", fontWeight: 500 }}>Not part of your role here</b><p className="small" style={{ maxWidth: 380 }}>You’re a {myRole} in {s?.cycle.product}. A manager can change your role in Settings › People.</p></div></div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceSwitcher() {
  const { s, workspaces, switchTo, refresh } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [open]);
  if (!s) return null;
  const sub = s.cycle.name.toLowerCase().startsWith(s.cycle.product.toLowerCase()) ? s.cycle.name.slice(s.cycle.product.length).replace(/^\s*·?\s*/, "") : s.cycle.name;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="cyc" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title="Switch workspace" style={{ width: "100%", border: 0, textAlign: "left" }}>
        <span className="ws-prod">{s.cycle.product.slice(0, 1).toUpperCase()}</span>
        <span className="cyc-text" style={{ flex: 1 }}>
          <span className="cyc-name">{s.cycle.product}</span>
          <span className="cyc-sub"><i />{sub}</span>
        </span>
        <ChevronsUpDown size={14} className="muted" />
      </button>
      {open && (
        <div className="menu" role="menu" style={{ top: 58, bottom: "auto", width: "100%" }}>
          <div className="menu-label">Workspaces</div>
          {workspaces.map((w) => (
            <button key={w.id} role="menuitem" className={w.id === s.workspace ? "on" : ""} onClick={async () => { setOpen(false); if (w.id !== s.workspace) { await switchTo(w.id); router.push("/insights"); } }}>
              <span className="ws-prod" style={{ width: 22, height: 22, fontSize: 11, borderRadius: 6 }}>{w.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow" style={{ fontSize: 13, fontWeight: 500 }}>{w.name}</span>
              {w.id === s.workspace && <Check size={14} />}
            </button>
          ))}
          <div className="hr" style={{ margin: "5px 0" }} />
          <button role="menuitem" onClick={() => { setOpen(false); router.push("/workspaces/new"); }}><Plus size={14} /><span style={{ fontSize: 13 }}>New workspace</span></button>
          {!workspaces.some((w) => w.id === "ws_chalk" || w.id.startsWith("ws_demo_")) && (
            <button role="menuitem" onClick={async () => { setOpen(false); await fetch("/api/seed", { method: "POST" }); await refresh(); router.push("/insights"); }}><DumplingMark size={14} /><span style={{ fontSize: 13 }}>Open the chalk demo</span></button>
          )}
        </div>
      )}
    </div>
  );
}

function Welcome() {
  const { refresh } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(520px, 100%)", textAlign: "center" }}>
        <span className="ws-mark" style={{ width: 52, height: 52, borderRadius: 15, margin: "0 auto" }}><DumplingMark size={30} /></span>
        <h1 style={{ marginTop: 18 }}>Dumpling</h1>
        <p className="muted" style={{ marginTop: 8 }}>UAT feedback, neatly folded. Start a workspace for your product, or open the demo to see a test cycle already under way.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 22 }}>
          <button className="btn primary lg" onClick={() => router.push("/workspaces/new")}><Plus size={15} />New workspace</button>
          <button className="btn lg" disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/seed", { method: "POST" }); await refresh(); setBusy(false); router.push("/insights"); }}>{busy ? <Dots /> : null}Open the chalk demo</button>
        </div>
      </div>
    </div>
  );
}

function Account() {
  const { s, me } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [open]);
  if (!me) return null;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">{me.email}</div>
          <button role="menuitem" onClick={async () => { await fetch("/api/auth/signout", { method: "POST" }); location.href = "/signin"; }}><LogOut size={14} /><span style={{ fontSize: 13 }}>Sign out</span></button>
        </div>
      )}
      <button className="me-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar t={me} />
        <span className="grow"><div className="nm">{me.name}</div><div className="sb">{s ? `${s.me.role[0]!.toUpperCase()}${s.me.role.slice(1)} · ${s.cycle.product}` : "Signed in"}</div></span>
        <ChevronsUpDown size={14} className="muted" />
      </button>
    </div>
  );
}

function Viewing({ role }: { role: Role }) {
  const { s, testerId } = useStore();
  if (!s) return null;
  if (!(s.demo && s.me.role === "manager")) return <span className="viewing"><Avatar t={s.me} size="sm" />{s.me.name} · {s.me.role}</span>;
  if (role === "tester") {
    const t = s.testers.find((x) => x.id === testerId) ?? s.testers[0];
    if (!t) return <span className="viewing" style={{ paddingLeft: 9 }}>No testers yet</span>;
    return <span className="viewing"><Avatar t={t} size="sm" />Viewing as {t.name} · tester</span>;
  }
  if (role === "developer") return <span className="viewing"><Avatar t={{ name: "Dev team" }} size="sm" />Viewing as the developer</span>;
  return <span className="viewing"><Avatar t={{ name: s.manager.split(" (")[0]! }} size="sm" />Viewing as {s.manager.split(" (")[0]} · UAT manager</span>;
}

function Persona() {
  const { s, testerId, setTesterId } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [open]);
  if (!s) return null;
  const people = s.testers.filter((x) => !x.userId && x.id.startsWith("t_") && x.id !== "t_field");
  if (!people.length) return <Link href="/settings?tab=people" className="me-btn"><span className="avatar" style={{ background: "var(--raise)", color: "var(--text-2)" }}><UserPlus size={13} /></span><span className="grow"><div className="nm">Add testers</div><div className="sb">No one is testing yet</div></span></Link>;
  const t = people.find((x) => x.id === testerId) ?? people[0]!;
  return (
    <div ref={ref}>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Demo: act as a sample tester</div>
          {people.map((x) => (
            <button key={x.id} role="menuitem" className={x.id === t.id ? "on" : ""} onClick={() => { setTesterId(x.id); setOpen(false); }}>
              <Avatar t={x} size="sm" />
              <span className="grow"><div style={{ fontSize: 13, fontWeight: 500 }}>{x.name}</div><div className="small muted">{x.env.browser} · {x.env.os}</div></span>
              {x.id === t.id && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
      <button className="me-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="persona">
        <Avatar t={t} />
        <span className="grow"><div className="nm">{t.name}</div><div className="sb">Demo tester · {t.env.browser}</div></span>
        <ChevronsUpDown size={14} className="muted" />
      </button>
    </div>
  );
}
