"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dots, DumplingMark } from "./ui";

/** The landing: one hero in a wireframe frame, and a way in without an account. */
export default function Landing() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function demo() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/demo", { method: "POST" }).catch(() => null);
    if (r?.ok) location.href = "/insights";
    else { setErr("The demo didn’t open — try again in a moment."); setBusy(false); }
  }
  return (
    <div className="wire">
      <header className="wire-top">
        <span className="row" style={{ gap: 9 }}><span className="ws-mark" style={{ width: 24, height: 24, borderRadius: 7 }}><DumplingMark size={15} /></span><b style={{ fontSize: 14.5 }}>Dumpling</b></span>
        <span className="row" style={{ gap: 4 }}><Link href="/signin" className="btn ghost sm">Sign in</Link><Link href="/signup" className="btn sm">Create an account</Link></span>
      </header>

      <main className="wire-frame">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <span className="wire-label">UAT · feedback · tickets</span>
        <h1 className="wire-title">Messy feedback in.<br />Clear tickets out.</h1>
        <p className="wire-sub">Testers write in their own words. Dumpling folds the duplicates into one ticket. You approve every one.</p>
        <div className="row" style={{ gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          <button className="btn primary lg" onClick={demo} disabled={busy}>{busy ? <Dots /> : <>Try the chalk demo <ArrowRight size={15} /></>}</button>
          <Link href="/signup" className="btn lg wire-ghost">Start your own workspace</Link>
        </div>
        <p className="wire-note">No account needed for the demo</p>
        {err && <p className="small" style={{ color: "var(--bug)", marginTop: 10 }}>{err}</p>}

        {/* The idea, drawn: five notes about one bug fold into one ticket. */}
        <svg className="wire-diagram" viewBox="0 0 640 120" role="img" aria-label="Five notes fold into one case, then one ticket">
          {[14, 34, 54, 74, 94].map((y, i) => (
            <g key={y}>
              <rect x="20" y={y - 7} width="120" height="14" rx="3" />
              <line x1="34" y1={y} x2={112 - i * 8} y2={y} className="faint" />
              <path d={`M140 ${y} C 200 ${y}, 210 60, 262 60`} />
            </g>
          ))}
          <rect x="262" y="40" width="116" height="40" rx="6" />
          <text x="320" y="64">1 case</text>
          <path d="M378 60 H 470" />
          <path d="M462 54 L 470 60 L 462 66" />
          <rect x="470" y="40" width="150" height="40" rx="6" className="accent" />
          <text x="545" y="64" className="accent">1 ticket · approved</text>
          <text x="80" y="114">5 notes, 5 wordings</text>
        </svg>
      </main>

      <footer className="wire-foot">AI Studio Hackathon · UAT, Untangled · <a className="link" href="https://github.com/Theboygenius07/dumpling">source</a></footer>
    </div>
  );
}
