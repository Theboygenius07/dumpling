"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Download, FileText, Globe, Plug, Server } from "lucide-react";
import { Avatar, Dots, NOTE_ICON, NOTE_STATUS, Status, ago, testerOf, useStore } from "../ui";

function Code({ text, children }: { text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <pre className="code">{children}</pre>
      <button className="btn sm code-copy" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function ConnectPage() {
  const { s, refresh, toast } = useStore();
  const [origin, setOrigin] = useState("http://localhost:4100");
  const [busy, setBusy] = useState(false);
  useEffect(() => setOrigin(location.origin), []);

  const web = s?.sources?.find((x) => x.kind === "widget");
  const webKey = web?.key;
  // The live preview runs the real widget, pointed at this Dumpling, inside the frame below.
  useEffect(() => {
    if (!webKey || document.querySelector("script[data-dumpling-preview]")) return;
    const el = document.createElement("script");
    el.src = "/widget.js";
    el.async = true;
    el.dataset.key = webKey;
    el.dataset.app = s?.cycle.product ?? "the app";
    el.dataset.target = "#heard-preview";
    el.dataset.dumplingPreview = "";
    document.body.appendChild(el);
    return () => {
      el.remove();
      document.querySelectorAll("[data-dumpling-widget]").forEach((n) => n.remove());
    };
    // Keyed on the key string: the store refreshes every few seconds and must not rebuild the widget.
  }, [webKey]);

  if (!s) return <div className="page empty"><Dots /></div>;
  const recent = s.feedback.filter((f) => f.source !== "tester").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const key = web?.key ?? "dmp_…";
  const product = s.cycle.product;
  const snippet = `<script src="${origin}/widget.js"\n        data-key="${key}" data-app="${product}" async></script>`;
  const curl = `curl -X POST ${origin}/api/intake \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text": "The share link asks my friend to sign in", "kind": "problem", "name": "Ada", "page": "/board/123"}'`;

  async function importChalk() {
    setBusy(true);
    try {
      const r = await fetch("/api/import-chalk", { method: "POST" }).then((r) => r.json());
      await refresh();
      toast(r.imported ? `Imported ${r.imported} report${r.imported > 1 ? "s" : ""} from chalk.` : r.message ?? "Nothing new from chalk.");
    } finally { setBusy(false); }
  }

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="head">
        <div>
          <h1>Connect your app</h1>
          <p>Bring feedback from inside your product into the same place as your testers’ notes. It’s read, grouped and drafted the same way — and a person still decides every one.</p>
        </div>
      </div>

      <div className="panel">
        {(s.sources ?? []).map((src) => (
          <div key={src.id} className="src-row">
            <span className="src-ic">{src.kind === "widget" ? <Globe size={16} /> : src.kind === "chalk" ? <FileText size={16} /> : <Server size={16} />}</span>
            <div>
              <div style={{ fontWeight: 500 }}>{src.name}</div>
              <div className="small muted">{src.kind === "widget" ? "Feedback widget and API" : "Imports chalk’s own Report a problem log"} · {src.count} {src.count === 1 ? "note" : "notes"}{src.lastAt ? ` · last ${ago(src.lastAt)}` : ""}</div>
            </div>
            {src.kind === "chalk"
              ? <button className="btn sm" disabled={busy} onClick={importChalk}>{busy ? <Dots /> : <Download size={13} />}Import now</button>
              : <span className="pill good"><span className="dot" />Connected</span>}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 22, alignItems: "start", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)" }}>
        <div className="stack-16">
          <div>
            <h3>1 · Add the feedback button to your app</h3>
            <p className="small muted" style={{ marginTop: 3 }}>One line before <span className="mono">&lt;/body&gt;</span>. People write in their own words; the page, their browser and any recent errors are attached for them.</p>
          </div>
          <Code text={snippet}>
            <span className="k">&lt;script</span> src=<span className="s">&quot;{origin}/widget.js&quot;</span>{"\n"}        data-key=<span className="s">&quot;{key}&quot;</span> data-app=<span className="s">&quot;{product}&quot;</span> async<span className="k">&gt;&lt;/script&gt;</span>
          </Code>
          <div>
            <h3>2 · Or send from your server</h3>
            <p className="small muted" style={{ marginTop: 3 }}>For app-store reviews, support tickets or anything else you already collect.</p>
          </div>
          <Code text={curl}>
            <span className="k">curl</span> -X POST {origin}/api/intake \{"\n"}  -H <span className="s">&quot;Authorization: Bearer {key}&quot;</span> \{"\n"}  -H <span className="s">&quot;Content-Type: application/json&quot;</span> \{"\n"}  -d <span className="s">&apos;{`{"text": "The share link asks my friend to sign in", "kind": "problem", "name": "Ada", "page": "/board/123"}`}&apos;</span>
          </Code>
          <p className="small muted">Every note gets the same treatment as a tester’s: Dumpling says back what it heard, matches it to known problems, and nothing becomes a ticket until a person approves it.</p>
        </div>

        <div className="stack">
          <div className="row between"><h3>Try it — {product} with the button added</h3><span className="small muted">Live</span></div>
          <div id="heard-preview" className="preview">
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderBottom: "1px solid #e6e6ea", background: "#fff" }}>
              <i style={{ width: 9, height: 9, borderRadius: 5, background: "#ff5f57" }} /><i style={{ width: 9, height: 9, borderRadius: 5, background: "#febc2e" }} /><i style={{ width: 9, height: 9, borderRadius: 5, background: "#28c840" }} />
              <span className="small" style={{ marginLeft: 10, color: "#8b8d97" }}>{product}{product.toLowerCase() === "chalk" ? " · How do vaccines train the immune system?" : ""}</span>
            </div>
            <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ height: 96, borderRadius: 10, background: "#fff", boxShadow: "0 0 0 1px #e6e6ea", padding: 12 }}>
                  <div style={{ width: "55%", height: 9, borderRadius: 5, background: "#e4e4e9" }} />
                  <div style={{ width: "85%", height: 7, borderRadius: 4, background: "#efeff2", marginTop: 12 }} />
                  <div style={{ width: "70%", height: 7, borderRadius: 4, background: "#efeff2", marginTop: 7 }} />
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="lhead" style={{ borderRadius: "10px 10px 0 0" }}><Plug size={13} />Recent from your app<span className="muted" style={{ fontWeight: 400 }}>{recent.length}</span></div>
            {!recent.length && <p className="small muted" style={{ padding: "12px 14px" }}>Nothing yet. Send one from the preview above.</p>}
            {recent.map((f) => (
              <Link key={f.id} href="/review" className="src-row" style={{ gridTemplateColumns: "26px 1fr auto", padding: "10px 14px" }}>
                <Avatar t={testerOf(s, f.testerId)} />
                <div style={{ minWidth: 0 }}>
                  <div className="clip" style={{ fontWeight: 500 }}>{f.text}</div>
                  <div className="small muted clip">{f.origin?.page ? f.origin.page.replace(/^https?:\/\/[^/]+/, "") || "/" : product} · {ago(f.at)}</div>
                </div>
                <span className="row small" style={{ gap: 6, color: "var(--text-2)" }}><Status kind={NOTE_ICON[f.status]} />{NOTE_STATUS[f.status].label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
