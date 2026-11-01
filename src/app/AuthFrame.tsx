"use client";
import { DumplingMark } from "./ui";

export function AuthFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(400px, 100%)" }}>
        <div className="row" style={{ justifyContent: "center", gap: 10, marginBottom: 22 }}>
          <span className="ws-mark" style={{ width: 34, height: 34, borderRadius: 10 }}><DumplingMark size={20} /></span>
          <b style={{ fontSize: 18 }}>Dumpling</b>
        </div>
        <div className="panel pad stack-16">
          <div><h2>{title}</h2><p className="small muted" style={{ marginTop: 4 }}>{sub}</p></div>
          {children}
        </div>
      </div>
    </div>
  );
}
