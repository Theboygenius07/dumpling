"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Dots, post, useStore } from "../ui";

export default function SettingsPage() {
  const { s, refresh, toast } = useStore();
  const [f, setF] = useState({ product: "", productAbout: "", ticketPrefix: "", productUrl: "", name: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (s) setF({ product: s.cycle.product, productAbout: s.cycle.productAbout ?? "", ticketPrefix: s.cycle.ticketPrefix ?? "", productUrl: s.cycle.productUrl, name: s.cycle.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!s]);
  if (!s) return <div className="page empty"><Dots /></div>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const prefix = (f.ticketPrefix || "T").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "T";

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="head">
        <div>
          <h1>Workspace settings</h1>
          <p>Heard works with any product. This tells it what it’s testing — the AI reads every note with this in mind — and how tickets are numbered.</p>
        </div>
      </div>
      <div className="panel pad stack-16">
        <div className="grid-2">
          <label className="field"><span className="label">Product name</span><input className="input" value={f.product} onChange={set("product")} /></label>
          <label className="field"><span className="label">Ticket prefix</span><input className="input" value={f.ticketPrefix} onChange={set("ticketPrefix")} placeholder="CH" /></label>
        </div>
        <label className="field"><span className="label">What it is, in a few words</span><input className="input" value={f.productAbout} onChange={set("productAbout")} placeholder="an AI teaching whiteboard" /></label>
        <label className="field"><span className="label">Where testers open it</span><input className="input" value={f.productUrl} onChange={set("productUrl")} /></label>
        <label className="field"><span className="label">Test cycle</span><input className="input" value={f.name} onChange={set("name")} /></label>
        <div className="well small" style={{ padding: "10px 12px", color: "var(--text-2)" }}>
          Heard will read notes as feedback on <b style={{ color: "var(--text)", fontWeight: 500 }}>{f.product || "your product"}{f.productAbout ? `, ${f.productAbout}` : ""}</b>. The next ticket will be <b style={{ color: "var(--text)", fontWeight: 500 }}>{prefix}-{s.nextTicket}</b>.
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn primary" disabled={busy || !f.product.trim()} onClick={async () => {
            setBusy(true);
            try { await post("/api/workspace", f); await refresh(); toast("Workspace saved."); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
          }}>{busy ? <Dots /> : <Check size={14} />}Save</button>
        </div>
      </div>
    </div>
  );
}
