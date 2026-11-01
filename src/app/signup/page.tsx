"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dots, post } from "../ui";
import { AuthFrame } from "../AuthFrame";

export default function SignUpPage() {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [invite, setInvite] = useState<{ workspace: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("invite");
    if (!token) return;
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((j) => {
      if (j.email) { setInvite({ workspace: j.workspace, role: j.role }); setF((x) => ({ ...x, email: j.email })); }
      else setErr(j.message);
    }).catch(() => {});
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await post("/api/auth/signup", f); location.href = "/insights"; } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <AuthFrame title="Create your account" sub={invite ? `You’re invited to ${invite.workspace} as a ${invite.role}.` : "Start a workspace for your product, or open the demo."}>
      <form className="stack-16" onSubmit={go}>
        <label className="field"><span className="label">Your name</span><input className="input" autoComplete="name" autoFocus value={f.name} onChange={set("name")} /></label>
        <label className="field"><span className="label">Email</span><input className="input" type="email" autoComplete="email" value={f.email} onChange={set("email")} readOnly={!!invite} /></label>
        <label className="field"><span className="label">Password</span><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} placeholder="At least 8 characters" /></label>
        {err && <p className="small" style={{ color: "var(--bug)" }}>{err}</p>}
        <button className="btn primary lg block" disabled={busy || !f.name || !f.email || f.password.length < 8}>{busy ? <Dots /> : <>Create account <ArrowRight size={14} /></>}</button>
      </form>
      <p className="small muted" style={{ textAlign: "center" }}>Already have one? <Link className="link" href="/signin">Sign in</Link></p>
    </AuthFrame>
  );
}
