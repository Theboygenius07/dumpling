"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChartColumn, Check, ChevronsUpDown, FlaskConical, Inbox, Lightbulb, ListChecks, Plug, Settings, Ticket } from "lucide-react";
import { Avatar, HeardMark, queue, useStore } from "./ui";

type Role = "tester" | "manager" | "developer" | "workspace";
type Item = { href: string; label: string; icon: React.ReactNode; role: Role; n?: number; hot?: boolean };

function roleOf(path: string): Role {
  if (path.startsWith("/test") || path.startsWith("/notes")) return "tester";
  if (path.startsWith("/tickets")) return "developer";
  if (path.startsWith("/connect") || path.startsWith("/settings")) return "workspace";
  return "manager";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const role = roleOf(path);
  const { s, testerId } = useStore();
  // The voiceover recorder is a full-screen tool, not part of the product.
  if (path.startsWith("/voice")) return <>{children}</>;

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
  const here = groups.flatMap((g) => g.items).find((i) => path.startsWith(i.href));

  return (
    <div className="app">
      <aside className="side">
        <Link href="/insights" className="ws"><span className="ws-mark"><HeardMark size={15} /></span>Dumpling</Link>
        {s && (
          <Link href="/settings" className="cyc" title="Workspace settings">
            <span className="ws-prod">{s.cycle.product.slice(0, 1).toUpperCase()}</span>
            <span className="cyc-text">
              <span className="cyc-name">{s.cycle.product}</span>
              <span className="cyc-sub"><i />{s.cycle.name.toLowerCase().startsWith(s.cycle.product.toLowerCase()) ? s.cycle.name.slice(s.cycle.product.length).replace(/^\s*·?\s*/, "") : s.cycle.name}</span>
            </span>
          </Link>
        )}
        {groups.map((g) => (
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
        <div className="side-foot"><Persona /></div>
      </aside>
      <div className="main">
        <header className="ph">
          <span className="crumb">{here?.icon}{here?.label ?? "Dumpling"}</span>
          <span className="spacer" />
          <Viewing role={role} />
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

function Viewing({ role }: { role: Role }) {
  const { s, testerId } = useStore();
  if (!s) return null;
  if (role === "tester") {
    const t = s.testers.find((x) => x.id === testerId) ?? s.testers[0]!;
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
  const people = s.testers.filter((x) => x.id.startsWith("t_") && x.id !== "t_field");
  const t = people.find((x) => x.id === testerId) ?? people[0]!;
  return (
    <div ref={ref}>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Test as…</div>
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
        <span className="grow"><div className="nm">{t.name}</div><div className="sb">Testing as · {t.env.browser}</div></span>
        <ChevronsUpDown size={14} className="muted" />
      </button>
    </div>
  );
}
