"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  { id: "testing", kicker: "Test", title: "Guide every\ntest run", body: "Testers follow your script step by step and say what went wrong in their own words. Their setup comes attached. Dumpling asks one short question when something’s missing.", img: "/site/test.jpg", alt: "A tester writing what went wrong, with Dumpling replying beside it" },
  { id: "review", kicker: "Review", title: "Review one case\nat a time", body: "Reports of the same bug, in different words, become one case. See how sure Dumpling is, and why — then decide. Nothing is approved in bulk.", img: "/site/review-maybe.jpg", alt: "A report Dumpling isn’t sure about, with its reasons for and against" },
  { id: "tickets", kicker: "Ship", title: "Hand developers\nclear tickets", body: "Steps, expected and actual, every tester’s setup and their exact words — ready for GitHub or Jira.", img: "/site/ticket.jpg", alt: "A ticket with steps, expected and actual, and every reporter" },
  { id: "connect", kicker: "Connect", title: "Collect feedback\nfrom inside your app", body: "One line adds a feedback button to any web app. Real users’ notes land in the same queue as your testers’.", img: "/site/connect.jpg", alt: "Connections with their keys, the widget snippet and a live preview" },
  { id: "insights", kicker: "Insights", title: "Understand the\nwhole cycle", body: "Where testing hurts, where every note went, and whether every tester heard back.", img: "/site/insights.jpg", alt: "Insights across the test cycle" },
];

export default function Site() {
  const demo = useDemo();
  // Sections rise in as they reach the screen. The class is added here, so with
  // no script (or reduced motion) everything is simply shown.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".site");
    root?.classList.add("motion");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".site .reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  // Keep the address clean: in-page links scroll without adding "#section" to it,
  // and a link that arrives with one scrolls there and drops it.
  useEffect(() => {
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const goTo = (id: string, behavior: ScrollBehavior) => document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
    if (location.hash) {
      goTo(location.hash.slice(1), "auto");
      history.replaceState(null, "", location.pathname + location.search);
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href^="#"]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      goTo(a.getAttribute("href")!.slice(1), smooth ? "smooth" : "auto");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-wrap site-nav-in">
          <Link href="/" className="site-logo"><span className="ws-mark" style={{ width: 30, height: 30, borderRadius: 8 }}><DumplingMark size={20} /></span>Dumpling</Link>
          <nav className="site-links">
            <a href="#testing">Product</a><a href="#how">How it works</a><a href="#connect">Connect</a><a href="#insights">Insights</a>
            <a href="https://github.com/Theboygenius07/dumpling">GitHub</a>
          </nav>
          <div className="site-auth"><Link href="/signin" className="site-login">Log in</Link><Link href="/signup" className="site-pill">Sign up</Link></div>
        </div>
      </header>

      <section className="site-wrap site-hero site-in">
        <h1>Get clear feedback<br />from every tester</h1>
        <div className="site-hero-row">
          <p>Built for user acceptance testing. Testers write in their own words — you approve every ticket.</p>
          <button className="site-new" onClick={demo.go} disabled={demo.busy}><span>Demo</span>{demo.busy ? <Dots /> : <>Try it with chalk <ArrowRight size={13} /></>}</button>
        </div>
        <div className="site-hero-cta">
          <button className="site-pill lg" onClick={demo.go} disabled={demo.busy}>{demo.busy ? <Dots /> : "Try the chalk demo"}</button>
          <Link href="/signup" className="site-ghost">Start a workspace <ArrowRight size={14} /></Link>
        </div>
        {demo.err && <p className="small" style={{ color: "var(--bug)", marginTop: 10 }}>{demo.err}</p>}
      </section>

      <section className="site-wrap">
        <div className="site-shot hero-shot site-in"><img src="/site/review.jpg" alt="Dumpling’s review queue" width={2880} height={1800} /></div>
      </section>

      <section className="site-wrap site-statement" id="how">
        <h2 className="reveal">A calmer way to run UAT. <span>Dumpling turns scattered tester notes into one clear queue&nbsp;— and leaves every decision to a person.</span></h2>
      </section>

      <section className="site-wrap site-figs">
        <Fig n="0.1" title="Built for testers" body="Their own words, no forms. Browser, device and step come attached."><FigNotes /></Fig>
        <Fig n="0.2" title="Folded by AI" body="Duplicates become one case, with every tester credited for what they saw."><FigFold /></Fig>
        <Fig n="0.3" title="Decided by people" body="One case at a time. Every judgement shows its working and can be overruled."><FigDecide /></Fig>
      </section>

      {FEATURES.map((f) => (
        <section key={f.id} id={f.id} className="site-wrap site-feature">
          <div className="site-feature-head reveal">
            <div><span className="site-kicker">{f.kicker}</span><h2>{f.title.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</h2></div>
            <p>{f.body}</p>
          </div>
          <div className="site-shot reveal"><img src={f.img} alt={f.alt} width={2880} height={1800} /></div>
        </section>
      ))}

      <section className="site-wrap site-cta">
        <h2 className="reveal">Get clear feedback.<br /><span>Starting with your next test cycle.</span></h2>
        <div className="site-hero-cta reveal">
          <button className="site-pill lg" onClick={demo.go} disabled={demo.busy}>{demo.busy ? <Dots /> : "Try the chalk demo"}</button>
          <Link href="/signup" className="site-ghost">Sign up <ArrowRight size={14} /></Link>
        </div>
      </section>

      <footer className="site-foot">
        <div className="site-wrap site-foot-in">
          <div><span className="site-logo"><span className="ws-mark" style={{ width: 30, height: 30, borderRadius: 8 }}><DumplingMark size={20} /></span>Dumpling</span><span>UAT feedback, neatly folded.</span></div>
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
    <div className="site-fig reveal">
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
      {[0, 14, 28, 42].map((z, i) => <polygon key={z} points={slab(-30, -30, 70, 52, z - 20)} className={`layer${i === 3 ? " hi" : ""}`} style={{ "--i": i } as React.CSSProperties} />)}
      <g className="layer" style={{ "--i": 3 } as React.CSSProperties}>{[0, 1, 2].map((r) => <polyline key={r} points={`${iso(-22, -18 + r * 12, 22)} ${iso(26 - r * 9, -18 + r * 12, 22)}`} className="ln" />)}</g>
    </svg>
  );
}

function FigFold() {
  return (
    <svg viewBox="0 0 200 160" className="fig-svg">
      {[-46, -23, 0, 23, 46].map((y) => <path key={y} className="flow" d={`M18 ${80 + y} C 70 ${80 + y}, 80 80, 116 80`} />)}
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
