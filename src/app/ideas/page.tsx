"use client";
import Link from "next/link";
import { Avatar, Loading, fbOf, testerOf, useStore } from "../ui";

export default function IdeasPage() {
  const { s, empty } = useStore();
  if (!s) return <Loading empty={empty} />;
  const themes = s.groups
    .filter((g) => g.status === "idea" || (g.status === "open" && fbOf(s, g.memberIds[0]!)?.analysis?.kind === "idea"))
    .map((g) => ({ g, members: g.memberIds.map((id) => fbOf(s, id)!).filter(Boolean) }))
    .sort((a, b) => b.members.length - a.members.length);
  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow">For the product team</div>
        <h1 style={{ marginTop: 4 }}>Ideas backlog</h1>
        <p className="lede">Not every note is a bug. Ideas used to sit forgotten in spreadsheet cells; here they’re gathered into themes, counted, and every tester who asked has been told where their idea went.</p>
      </div>
      {!themes.length && <div className="card empty">No ideas yet.</div>}
      <div className="grid-3">
        {themes.map(({ g, members }) => (
          <div key={g.id} className="card stack-sm">
            <div className="row wrap" style={{ justifyContent: "space-between" }}>
              <span className={`chip ${g.status === "idea" ? "idea" : "warn"}`}>{g.status === "idea" ? "In the backlog" : "Waiting for review"}</span>
              <span className="chip ink">{members.length} {members.length === 1 ? "asked" : "asked"}</span>
            </div>
            <h3>{g.title}</h3>
            {members.map((f) => (
              <div key={f.id} className="row small" style={{ alignItems: "flex-start" }}>
                <Avatar t={testerOf(s, f.testerId)} sm />
                <span className="grow">“{f.text}”</span>
              </div>
            ))}
            {g.status !== "idea" && <Link className="btn sm" href="/review">Review →</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
