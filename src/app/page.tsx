"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dots, DumplingMark } from "./ui";

/** The landing: one hero, and a way in without an account. */
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
    <div className="hero">
      <header className="hero-top">
        <span className="row" style={{ gap: 9 }}><span className="ws-mark" style={{ width: 26, height: 26, borderRadius: 8 }}><DumplingMark size={16} /></span><b style={{ fontSize: 15 }}>Dumpling</b></span>
        <span className="row" style={{ gap: 6 }}><Link href="/signin" className="btn ghost sm">Sign in</Link><Link href="/signup" className="btn sm">Create an account</Link></span>
      </header>
      <main className="hero-main">
        <span className="ws-mark hero-mark"><DumplingMark size={38} /></span>
        <h1 className="hero-title">UAT feedback,<br />neatly folded.</h1>
        <p className="hero-sub">Testers say what went wrong in their own words. Dumpling folds the same bug, reported five different ways, into one ticket — asks a kind question when a note is thin — and a person decides every step.</p>
        <div className="row" style={{ gap: 10, justifyContent: "center", marginTop: 30, flexWrap: "wrap" }}>
          <button className="btn primary lg" onClick={demo} disabled={busy}>{busy ? <Dots /> : <>Try the chalk demo <ArrowRight size={15} /></>}</button>
          <Link href="/signup" className="btn lg">Start your own workspace</Link>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>No account needed for the demo — you get your own copy of a real test cycle of chalk, an AI teaching whiteboard.</p>
        {err && <p className="small" style={{ color: "var(--bug)", marginTop: 10 }}>{err}</p>}
      </main>
      <footer className="hero-foot small muted">Built for the AI Studio Hackathon · UAT, Untangled · <a className="link" href="https://github.com/Theboygenius07/dumpling">Source on GitHub</a></footer>
    </div>
  );
}
