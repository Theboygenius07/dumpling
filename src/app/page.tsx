"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dots, DumplingMark } from "./ui";

// The marketing site: Linear's grammar — a quiet nav, a left-aligned hero, the
// real product in a frame, a two-tone statement, figures, then feature by feature.

function useDemo() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/demo", { method: "POST" }).catch(() => null);
    if (r?.ok) location.href = "/insights";
    else { setErr("The demo didn’t open — try again in a moment."); setBusy(false); }
  };
  return { busy, err, go };
}

const FEATURES = [
  { id: "testing", kicker: "Run tests", title: "Testing,\nguided", body: "Testers follow your script one step at a time and say what went wrong in their own words. Their browser, device and step are attached for them. Dumpling says back what it understood — and asks one short question when something’s missing.", img: "/site/test.jpg", alt: "A tester writing what went wrong, with Dumpling replying beside it" },
  { id: "review", kicker: "Review", title: "One case\nat a time", body: "The same bug, reported five ways, becomes one case. Dumpling shows how sure it is, and why — for and against. You decide: keep a report in, take it out, ask a kind question, change the severity. Nothing is approved in bulk.", img: "/site/review-maybe.jpg", alt: "A report Dumpling isn’t sure about, with its reasons for and against" },
  { id: "tickets", kicker: "Tickets", title: "Tickets developers\ncan start from", body: "Steps to reproduce, expected and actual, every tester’s setup and exact words — and who drafted it and who approved it. Copy it into GitHub or Jira, or push it there directly.", img: "/site/ticket.jpg", alt: "A ticket with steps, expected and actual, and every reporter" },
  { id: "connect", kicker: "Connect your app", title: "Feedback from\ninside your app", body: "One line adds a feedback button to any web app; an API takes reviews from anywhere else. Real users’ notes land in the same queue, folded in with your testers’ reports of the same bug.", img: "/site/connect.jpg", alt: "Connections with their keys, the widget snippet and a live preview" },
  { id: "insights", kicker: "Insights", title: "See the whole\ncycle", body: "Where testing hurts, where every note went, whether every tester heard back — and how often you agreed with Dumpling, so you know when to trust it.", img: "/site/insights.jpg", alt: "Insights across the test cycle" },
];

export default function Site() {
  const demo = useDemo();
  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-wrap site-nav-in">
          <Link href="/" className="site-logo"><span className="ws-mark" style={{ width: 22, height: 22, borderRadius: 6 }}><DumplingMark size={14} /></span>Dumpling</Link>
          <nav className="site-links">
            <a href="#testing">Product</a><a href="#how">How it works</a><a href="#connect">Connect</a><a href="#insights">Insights</a>
            <a href="https://github.com/Theboygenius07/dumpling">GitHub</a>
          </nav>
          <div className="site-auth"><Link href="/signin" className="site-login">Log in</Link><Link href="/signup" className="site-pill">Sign up</Link></div>
        </div>
      </header>

      <section className="site-wrap site-hero">
        <h1>Get clear feedback<br />from every tester</h1>
        <div className="site-hero-row">
          <p>Testers say what went wrong in their own words. Dumpling turns it into clear tickets — and you approve each one.</p>
          <button className="site-new" onClick={demo.go} disabled={demo.busy}><span>Demo</span>{demo.busy ? <Dots /> : <>Try it with chalk <ArrowRight size={13} /></>}</button>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 30 }}>
          <button className="site-pill lg" onClick={demo.go} disabled={demo.busy}>{demo.busy ? <Dots /> : "Try the chalk demo"}</button>
          <Link href="/signup" className="site-ghost">Start your own workspace <ArrowRight size={14} /></Link>
        </div>
        {demo.err && <p className="small" style={{ color: "var(--bug)", marginTop: 10 }}>{demo.err}</p>}
      </section>

      <section className="site-wrap">
        <div className="site-shot hero-shot"><img src="/site/review.jpg" alt="Dumpling’s review queue" width={2880} height={1800} /></div>
      </section>

      <section className="site-wrap site-statement" id="how">
        <h2>One bug, five reports, one ticket. <span>Dumpling folds the same problem — told five different ways — into one case, shows its working, and leaves every decision to a person.</span></h2>
      </section>

      <section className="site-wrap site-figs">
        <Fig n="0.1" title="Easy to give" body="Testers write in their own words. No forms; their setup is attached for them."><FigNotes /></Fig>
        <Fig n="0.2" title="Easy to act on" body="Duplicates fold into one case, with every witness credited for what they added."><FigFold /></Fig>
        <Fig n="0.3" title="A person decides" body="One case at a time. Every judgement shows how sure it is, and can be overruled in a click."><FigDecide /></Fig>
      </section>

      {FEATURES.map((f) => (
        <section key={f.id} id={f.id} className="site-wrap site-feature">
          <div className="site-feature-head">
            <div><span className="site-kicker">{f.kicker}</span><h2>{f.title.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</h2></div>
            <p>{f.body}</p>
          </div>
          <div className="site-shot"><img src={f.img} alt={f.alt} width={2880} height={1800} /></div>
        </section>
      ))}

      <section className="site-wrap site-cta">
        <h2>Get clear feedback.<br /><span>Starting with your next test cycle.</span></h2>
        <div className="row" style={{ gap: 10, marginTop: 28 }}>
          <button className="site-pill lg" onClick={demo.go} disabled={demo.busy}>{demo.busy ? <Dots /> : "Try the chalk demo"}</button>
          <Link href="/signup" className="site-ghost">Sign up <ArrowRight size={14} /></Link>
        </div>
      </section>

      <footer className="site-foot">
        <div className="site-wrap site-foot-in">
          <div><span className="site-logo"><span className="ws-mark" style={{ width: 22, height: 22, borderRadius: 6 }}><DumplingMark size={14} /></span>Dumpling</span><span>UAT feedback, neatly folded.</span></div>
          <div><b>Product</b><a href="#testing">Run tests</a><a href="#review">Review</a><a href="#tickets">Tickets</a><a href="#connect">Connect your app</a></div>
          <div><b>Try it</b><button onClick={demo.go}>The chalk demo</button><Link href="/signup">Sign up</Link><Link href="/signin">Log in</Link></div>
          <div><b>Project</b><a href="https://github.com/Theboygenius07/dumpling">Source on GitHub</a><span>AI Studio Hackathon</span><span>UAT, Untangled</span></div>
        </div>
      </footer>
    </div>
  );
}

function Fig({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="site-fig">
      <span className="site-fig-n">FIG {n}</span>
      <div className="site-fig-art">{children}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

// Line drawings in the figures' isometric style.
const iso = (x: number, y: number, z = 0) => `${(100 + (x - y) * 0.866).toFixed(1)},${(70 + (x + y) * 0.5 - z).toFixed(1)}`;
const slab = (x: number, y: number, w: number, d: number, z: number) => [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)].join(" ");

function FigNotes() {
  return (
    <svg viewBox="0 0 200 160" className="fig-svg">
      {[0, 14, 28, 42].map((z, i) => <polygon key={z} points={slab(-30, -30, 70, 52, z - 20)} className={i === 3 ? "hi" : ""} />)}
      {[0, 1, 2].map((r) => <polyline key={r} points={`${iso(-22, -18 + r * 12, 22)} ${iso(26 - r * 9, -18 + r * 12, 22)}`} className="ln" />)}
    </svg>
  );
}

function FigFold() {
  return (
    <svg viewBox="0 0 200 160" className="fig-svg">
      {[-46, -23, 0, 23, 46].map((y) => <path key={y} d={`M18 ${80 + y} C 70 ${80 + y}, 80 80, 116 80`} />)}
      <polygon points={slab(14, -14, 30, 30, 18)} className="hi" />
      <polygon points={[iso(14, 16, 18), iso(44, 16, 18), iso(44, 16, -6), iso(14, 16, -6)].join(" ")} />
      <polygon points={[iso(44, -14, 18), iso(44, 16, 18), iso(44, 16, -6), iso(44, -14, -6)].join(" ")} />
    </svg>
  );
}

function FigDecide() {
  return (
    <svg viewBox="0 0 200 160" className="fig-svg">
      {[0, 1, 2].map((i) => <polygon key={i} points={slab(-40 + i * 34, -40 + i * 34, 26, 26, 0)} className={i === 1 ? "hi" : ""} />)}
      <polyline points={`${iso(-3, 4, 4)} ${iso(5, 10, 4)} ${iso(18, -4, 4)}`} className="ok" />
    </svg>
  );
}
