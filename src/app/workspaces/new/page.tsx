"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dots, post, useStore } from "../../ui";

export default function NewWorkspacePage() {
  const { refresh, toast } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ product: "", productAbout: "", ticketPrefix: "", productUrl: "", name: "", manager: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const prefix = (f.ticketPrefix || f.product).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "T";

  async function create() {
    setBusy(true);
    try {
      await post("/api/workspaces", f);
      await refresh();
      toast(`${f.product} is ready — add your testers next.`);
      router.push("/settings?tab=people");
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="head">
        <div>
          <h1>New workspace</h1>
          <p>One workspace per product. Dumpling reads every note with this product in mind; testers, scripts and app connections live inside it.</p>
        </div>
      </div>
      <div className="panel pad stack-16">
        <div className="grid-2">
          <label className="field"><span className="label">Product name</span><input className="input" autoFocus value={f.product} onChange={set("product")} placeholder="Ledgerly" /></label>
          <label className="field"><span className="label">Ticket prefix</span><input className="input" value={f.ticketPrefix} onChange={set("ticketPrefix")} placeholder={prefix} /></label>
        </div>
        <label className="field"><span className="label">What it is, in a few words</span><input className="input" value={f.productAbout} onChange={set("productAbout")} placeholder="a bookkeeping app for small shops" /></label>
        <label className="field"><span className="label">Where testers open it</span><input className="input" value={f.productUrl} onChange={set("productUrl")} placeholder="https://staging.example.com" /></label>
        <div className="grid-2">
          <label className="field"><span className="label">First test cycle</span><input className="input" value={f.name} onChange={set("name")} placeholder={`${f.product || "Product"} · UAT cycle 1`} /></label>
          <label className="field"><span className="label">Your name (UAT manager)</span><input className="input" value={f.manager} onChange={set("manager")} placeholder="Shay" /></label>
        </div>
        <div className="well small" style={{ padding: "10px 12px", color: "var(--text-2)" }}>
          Next: add your testers, write a test script, and connect your app. Tickets will be numbered <b style={{ color: "var(--text)", fontWeight: 500 }}>{prefix}-1</b>, <b style={{ color: "var(--text)", fontWeight: 500 }}>{prefix}-2</b>…
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => router.back()}>Cancel</button>
          <button className="btn primary" disabled={busy || !f.product.trim()} onClick={create}>{busy ? <Dots /> : null}Create workspace <ArrowRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
