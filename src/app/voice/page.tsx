"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Mic, Play, Square } from "lucide-react";
import { HeardMark } from "../ui";
import { SCENES } from "./script";

type Phase = "idle" | "recording" | "saving";

export default function VoicePage() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [takes, setTakes] = useState<Record<string, string>>({});
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const raf = useRef(0);
  const scene = SCENES[idx]!;

  useEffect(() => {
    fetch("/api/voice").then((r) => r.json()).then((j) => setDone(new Set(j.recorded))).catch(() => {});
    return () => { cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function mic() {
    if (stream.current) return stream.current;
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    stream.current = s;
    // A live level meter, so a dead microphone is obvious before a whole take is lost.
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(s).connect(an);
    const buf = new Float32Array(an.fftSize);
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5));
      if (rec.current?.state === "recording") setSecs((performance.now() - started.current) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    return s;
  }

  const start = useCallback(async () => {
    setErr(null);
    try {
      const s = await mic();
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(s, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.start();
      rec.current = r;
      started.current = performance.now();
      setSecs(0);
      setPhase("recording");
    } catch {
      setErr("Couldn’t open the microphone — allow it in the browser’s address bar, then try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(async () => {
    const r = rec.current;
    if (!r || r.state !== "recording") return;
    setPhase("saving");
    const blob: Blob = await new Promise((res) => { r.onstop = () => res(new Blob(chunks.current, { type: r.mimeType })); r.stop(); });
    const id = scene.id;
    try {
      const resp = await fetch(`/api/voice?scene=${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).message ?? "Didn’t save");
      setTakes((t) => ({ ...t, [id]: URL.createObjectURL(blob) }));
      setDone((d) => new Set(d).add(id));
      setPhase("idle");
      setTimeout(() => setIdx((i) => (SCENES[i]?.id === id ? Math.min(SCENES.length - 1, i + 1) : i)), 450);
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }, [scene.id]);

  const play = useCallback(() => { const u = takes[scene.id]; if (u) new Audio(u).play(); }, [takes, scene.id]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); phase === "recording" ? stop() : phase === "idle" && start(); }
      if (phase !== "idle") return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(SCENES.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "Enter") play();
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [phase, start, stop, play]);

  const all = done.size === SCENES.length;
  const parts = scene.line.split(/(\[your name\])/);

  return (
    <div style={{ minHeight: "100vh", background: "var(--side)", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <header className="row" style={{ padding: "16px 24px", gap: 10 }}>
        <span className="ws-mark" style={{ width: 26, height: 26 }}><HeardMark size={16} /></span>
        <b style={{ fontWeight: 600 }}>Record the voiceover</b>
        <span className="spacer" />
        <span className="small muted">{done.size} of {SCENES.length} lines recorded</span>
      </header>

      <main style={{ display: "grid", placeItems: "center", padding: "0 24px" }}>
        <div style={{ width: "min(860px, 100%)" }}>
          <div className="row" style={{ gap: 5, marginBottom: 28, flexWrap: "wrap" }}>
            {SCENES.map((x, i) => (
              <button key={x.id} onClick={() => phase === "idle" && setIdx(i)} title={x.screen}
                style={{ width: 26, height: 6, border: 0, borderRadius: 3, padding: 0, background: done.has(x.id) ? "var(--accent)" : "var(--active)", outline: i === idx ? "2px solid var(--text)" : "none", outlineOffset: 2 }} />
            ))}
          </div>
          <div className="small muted">Line {idx + 1} of {SCENES.length} · On screen: {scene.screen}</div>
          <p style={{ fontSize: 30, lineHeight: 1.45, fontWeight: 500, letterSpacing: "-0.015em", marginTop: 14, color: phase === "recording" ? "var(--text)" : "var(--text)" }}>
            {parts.map((p, i) => p === "[your name]" ? <span key={i} style={{ color: "var(--accent-2)", borderBottom: "2px dashed var(--accent)" }}>[your name]</span> : <span key={i}>{p}</span>)}
          </p>
          {idx === 0 && <p className="small muted" style={{ marginTop: 10 }}>Talk like you’re telling a friend. Change any word that doesn’t sound like you — the film times itself to whatever you say.</p>}

          <div className="row" style={{ marginTop: 34, gap: 12 }}>
            {phase === "recording" ? (
              <button className="btn lg" onClick={stop} style={{ background: "var(--red)", color: "#fff", boxShadow: "none" }}><Square size={14} fill="#fff" />Stop <span className="kbd" style={{ marginLeft: 4 }}>Space</span></button>
            ) : (
              <button className="btn primary lg" onClick={start} disabled={phase === "saving"}><Mic size={15} />{done.has(scene.id) ? "Record again" : "Record"} <span className="kbd" style={{ marginLeft: 4, background: "rgba(255,255,255,.15)", color: "#fff", boxShadow: "none" }}>Space</span></button>
            )}
            {takes[scene.id] && phase === "idle" && <button className="btn lg" onClick={play}><Play size={14} />Play take</button>}
            <span className="spacer" />
            <button className="icon-btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={phase !== "idle" || idx === 0} aria-label="Previous line"><ChevronLeft size={18} /></button>
            <button className="icon-btn" onClick={() => setIdx((i) => Math.min(SCENES.length - 1, i + 1))} disabled={phase !== "idle" || idx === SCENES.length - 1} aria-label="Next line"><ChevronRight size={18} /></button>
          </div>

          <div className="row" style={{ marginTop: 18, gap: 12 }}>
            <span style={{ width: 160, height: 6, borderRadius: 3, background: "var(--active)", overflow: "hidden" }}>
              <i style={{ display: "block", height: "100%", width: `${Math.round(level * 100)}%`, background: level > 0.85 ? "var(--orange)" : "var(--green)", transition: "width 60ms" }} />
            </span>
            <span className="small muted">
              {phase === "recording" ? `Recording · ${secs.toFixed(1)}s` : phase === "saving" ? "Saving…" : done.has(scene.id) ? "Saved ✓ — Space to redo, → for the next line" : stream.current ? "Microphone ready" : "Press Space to start — the browser will ask for the microphone"}
            </span>
          </div>
          {err && <p className="small" style={{ color: "var(--bug)", marginTop: 10 }}>{err}</p>}
          {all && <div className="done" style={{ marginTop: 26 }}><span className="tick">✓</span><div><b>All {SCENES.length} lines recorded.</b><p className="small" style={{ marginTop: 3 }}>Tell Claude “done” — it’ll time the film to your voice and render the 4K video. You can still redo any line first.</p></div></div>}
        </div>
      </main>

      <footer className="small muted" style={{ padding: "14px 24px", display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span><span className="kbd">Space</span> record / stop</span>
        <span><span className="kbd">←</span> <span className="kbd">→</span> previous / next line</span>
        <span><span className="kbd">Enter</span> play the take</span>
        <span>Silence at the start and end of each take is trimmed for you.</span>
      </footer>
    </div>
  );
}
