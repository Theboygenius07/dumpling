"use client";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Avatar, Dots, Empty, fbOf, first, testerOf, useStore } from "../ui";

export default function IdeasPage() {
  const { s } = useStore();
  if (!s) return <div className="page empty"><Dots /></div>;
  const themes = s.groups
    .filter((g) => g.status === "idea" || (g.status === "open" && fbOf(s, g.memberIds[0]!)?.analysis?.kind === "idea"))
    .map((g) => ({ g, members: g.memberIds.map((id) => fbOf(s, id)!).filter(Boolean) }))
    .sort((a, b) => b.members.length - a.members.length || (a.g.status === "idea" ? -1 : 1));
  const most = Math.max(1, ...themes.map((t) => t.members.length));
  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>Ideas backlog</h1>
          <p>Not every note is a bug. Ideas used to sit forgotten in spreadsheet cells — here they’re gathered into themes and counted, and everyone who asked has been told where their idea went.</p>
        </div>
      </div>
      {!themes.length ? (
        <div className="panel"><Empty icon={<Lightbulb size={20} />} title="No ideas yet">When a tester suggests something, it lands here as a theme.</Empty></div>
      ) : (
        <div className="grid-3">
          {themes.map(({ g, members }) => (
            <div key={g.id} className="panel pad stack" style={{ display: "flex", flexDirection: "column" }}>
              <div className="row between">
                <span className={`pill ${g.status === "idea" ? "idea" : "warn"}`}>{g.status === "idea" ? "In the backlog" : "Waiting for review"}</span>
                <span className="small muted">{members.length} {members.length === 1 ? "tester" : "testers"}</span>
              </div>
              <h3 style={{ fontSize: 18 }}>{g.title}</h3>
              <div className="progress" style={{ height: 6 }}><i style={{ width: `${(members.length / most) * 100}%`, background: "var(--peri)" }} /></div>
              <div className="stack" style={{ flex: 1 }}>
                {members.map((f) => (
                  <div key={f.id} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                    <Avatar t={testerOf(s, f.testerId)} size="sm" />
                    <div className="grow small"><span className="muted">{first(testerOf(s, f.testerId))}:</span> {f.text}</div>
                  </div>
                ))}
              </div>
              {g.status !== "idea" && <Link className="btn sm" href="/review" style={{ alignSelf: "flex-start" }}>Review it</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
