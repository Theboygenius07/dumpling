"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AuthFrame } from "../AuthFrame";
import { Dots, post } from "../ui";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await post("/api/auth/signin", { email, password });
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/insights";
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <AuthFrame title="Sign in" sub="UAT feedback, neatly folded.">
      <form className="stack-16" onSubmit={go}>
        <label className="field"><span className="label">Email</span><input className="input" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="small" style={{ color: "var(--bug)" }}>{err}</p>}
        <button className="btn primary lg block" disabled={busy || !email || !password}>{busy ? <Dots /> : <>Sign in <ArrowRight size={14} /></>}</button>
      </form>
      <p className="small muted" style={{ textAlign: "center" }}>New here? <Link className="link" href="/signup">Create an account</Link></p>
    </AuthFrame>
  );
}
