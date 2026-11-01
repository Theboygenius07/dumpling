"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, GitMerge, Lightbulb, MessageCircleQuestion, Minus, Plug, Plus, Sparkles, Split, Ticket as TicketIcon,
} from "lucide-react";
import type { Feedback, Group, Kind, Link, Severity, Ticket, TicketDraft } from "@/lib/types";
import {
  Avatar, Dots, Empty, KIND, Meter, Priority, SEV, Status, ago, fbOf, first, linkLabel, linksOf, otherEnd, post, queue, stepOf, sureWords, testerOf, topSeverity, useStore, type Item, type State,
} from "../ui";

type Act = (body: object, done: string, advance?: boolean) => Promise<boolean>;

export default function ReviewPage() {
  const { s, refresh, toast } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const items = useMemo(() => (s ? queue(s) : []), [s]);
  const idx = Math.max(0, items.findIndex((i) => i.id === sel));
  const current = items[idx];

  const go = useCallback((d: number) => { const n = items[idx + d]; if (n) setSel(n.id); }, [items, idx]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "j" || e.key === "ArrowDown") { go(1); e.preventDefault(); }
      if (e.key === "k" || e.key === "ArrowUp") { go(-1); e.preventDefault(); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [go]);

  if (!s) return <div className="page empty"><Dots /></div>;

  const act: Act = async (body, done, advance = true) => {
    const next = items[idx + 1]?.id ?? items[idx - 1]?.id ?? null;
    const was = current?.id;
    try {
      await post("/api/decide", body);
      await refresh();
      toast(done);
      // Move on only if they're still looking at the case they just decided.
      if (advance) setSel((cur) => (cur === was || cur === null ? next : cur));
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  };

  const waiting = s.feedback.filter((f) => f.status === "asked");
  const groups: { label: string; items: Item[] }[] = [
    { label: "Bugs", items: items.filter((i) => i.type === "group" && i.family === "bug") },
    { label: "Already known", items: items.filter((i) => i.type === "known") },
    { label: "Ideas", items: items.filter((i) => i.type === "group" && i.family === "idea") },
    { label: "Questions & praise", items: items.filter((i) => i.type === "single") },
  ];

  return (
    <div className="review">
      <aside className="queue">
        <div className="row between" style={{ padding: "4px 10px 2px" }}>
          <h3>To decide</h3>
          <span className="small muted">{items.length}</span>
        </div>
        {groups.filter((g) => g.items.length).map((g) => (
          <div key={g.label}>
            <div className="qgroup">{g.label}<span className="n">{g.items.length}</span></div>
            {g.items.map((i) => <QueueRow key={i.id} i={i} on={current?.id === i.id} onClick={() => setSel(i.id)} />)}
          </div>
        ))}
        {waiting.length > 0 && (
          <div>
            <div className="qgroup">Waiting on testers<span className="n">{waiting.length}</span></div>
            {waiting.map((f) => (
              <div key={f.id} className="qrow" style={{ cursor: "default" }}>
                <Status kind="progress" />
                <div><div className="t clip" style={{ color: "var(--text-2)" }}>{f.text}</div><div className="m">{first(testerOf(s, f.testerId))} · asked {ago(f.messages.at(-1)!.at)}</div></div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {current ? (
        <Case key={current.id} s={s} item={current} n={idx + 1} total={items.length} go={go} act={act} />
      ) : (
        <div className="case"><Empty icon={<CircleCheck size={20} />} title="All decided">Every note has had a person’s decision. New notes appear here as they arrive.</Empty></div>
      )}
    </div>
  );
}

function QueueRow({ i, on, onClick }: { i: Item; on: boolean; onClick: () => void }) {
  let icon: React.ReactNode, meta: string;
  if (i.type === "group") {
    const sev = topSeverity(i.members);
    icon = i.family === "bug" ? <Priority sev={sev} /> : <Status kind="idea" />;
    meta = i.family === "bug" ? `${i.members.length} ${i.members.length === 1 ? "report" : "reports"}` : `${i.members.length} ${i.members.length === 1 ? "tester" : "testers"}`;
  } else if (i.type === "known") {
    icon = <Status kind="known" />; meta = `${i.t.id} · new report`;
  } else {
    const k = i.f.analysis?.kind ?? "unclear";
    icon = <span className={`kind-dot ${k}`} style={{ margin: "3px 3px 0" }} />; meta = KIND[k];
  }
  return (
    <button className={`qrow ${on ? "on" : ""}`} onClick={onClick}>
      {icon}
      <span style={{ minWidth: 0 }}><div className="t clip">{i.title}</div><div className="m">{meta}</div></span>
    </button>
  );
}

// ---------- one case ----------

function Case({ s, item, n, total, go, act }: { s: State; item: Item; n: number; total: number; go: (d: number) => void; act: Act }) {
  return (
    <section className="case">
      <div className="case-nav">
        <button className="icon-btn" onClick={() => go(-1)} disabled={n <= 1} aria-label="Previous case"><ChevronLeft size={16} /></button>
        <button className="icon-btn" onClick={() => go(1)} disabled={n >= total} aria-label="Next case"><ChevronRight size={16} /></button>
        <span>{n} of {total}</span>
      </div>
      {item.type === "group" && <GroupCase s={s} g={item.g} members={item.members} family={item.family} act={act} />}
      {item.type === "known" && <KnownCase s={s} g={item.g} t={item.t} fresh={item.fresh} act={act} />}
      {item.type === "single" && <SingleCase s={s} f={item.f} act={act} />}
    </section>
  );
}

/** Heard's read of the case in one slim line; the reasoning sits behind each part. */
function Read({ parts }: { parts: { icon: React.ReactNode; text: React.ReactNode; why: string }[] }) {
  return (
    <div className="read">
      <span className="read-label"><Sparkles size={12} />Heard’s read</span>
      {parts.map((p, i) => <span key={i} className="read-part" title={p.why}>{p.icon}{p.text}</span>)}
    </div>
  );
}

function GroupCase({ s, g, members, family, act }: { s: State; g: Group; members: Feedback[]; family: "bug" | "idea"; act: Act }) {
  const near = useMemo(() => nearby(s, g), [s, g]);
  const testers = new Set(members.map((m) => m.testerId)).size;
  const browsers = [...new Set(members.map((m) => testerOf(s, m.testerId)?.env.browser.split(" ")[0]))];

  // "All of these are one problem" is only as sure as its least-sure pair.
  const inner = members.slice(1).map((f) => linksOf(s, f.id).find((l) => g.memberIds.includes(otherEnd(l, f.id)))).filter(Boolean) as Link[];
  const weakest = [...inner].sort((a, b) => a.score - b.score)[0];
  const ev = members.some((f) => f.analysis?.evidence === "strong") ? "strong" : members.some((f) => f.analysis?.evidence === "some") ? "some" : "thin";
  const missing = [...new Set(members.flatMap((f) => f.analysis?.missing ?? []))].slice(0, 2);
  const sev = topSeverity(members);
  const sevWhy = members.find((f) => f.analysis?.severity === sev)?.analysis?.severityWhy ?? "";

  return (
    <>
      <div className="case-title">{g.draft?.title ?? g.title}</div>
      <div className="case-meta">
        {family === "bug" ? "Bug" : "Idea"} · {members.length} {members.length === 1 ? "report" : "reports"} from {testers} {testers === 1 ? "tester" : "testers"} · {browsers.join(", ")}
      </div>
      {family === "bug" ? (
        <Read parts={[
          members.length > 1 && weakest
            ? { icon: <GitMerge size={13} />, text: <>{linkLabel(weakest).text.replace("the same", "one problem")} <Meter value={weakest.score} tone={linkLabel(weakest).tone} width={36} /></>, why: "The least certain match in this group. Open any report to see the reasons." }
            : { icon: <GitMerge size={13} />, text: "Only report so far", why: "No other note matches yet." },
          { icon: ev === "thin" ? <Clock size={13} /> : <Check size={13} />, text: ev === "strong" ? "Enough to act on" : ev === "some" ? "Mostly enough to act on" : "Needs a little more", why: ev === "thin" ? `Missing: ${missing.join(", ")}` : "Steps, setup and what happened are clear." },
          { icon: <Priority sev={sev} size={13} />, text: SEV[sev].label, why: sevWhy },
        ]} />
      ) : (
        <Read parts={[
          { icon: <Lightbulb size={13} />, text: "A product idea, not a bug", why: "A suggestion to make it better." },
          { icon: <Plus size={13} />, text: `${testers} ${testers === 1 ? "tester" : "testers"} asked`, why: "Heard gathers similar ideas into one theme." },
        ]} />
      )}

      <div className="case-body">
        <div>
          <div className="stack">
            {members.map((f, i) => <Report key={f.id} s={s} f={f} g={g} first={i === 0} act={act} />)}
          </div>
          {near.length > 0 && (
            <>
              <div className="section-label"><span className="label">Might be the same problem — you decide</span></div>
              <div className="stack">{near.map(({ f, l }) => <Maybe key={f.id} s={s} f={f} l={l} g={g} act={act} />)}</div>
            </>
          )}
        </div>
        <div className="decide">
          {family === "bug" ? <TicketPanel s={s} g={g} members={members} act={act} /> : <IdeaPanel s={s} g={g} members={members} act={act} />}
        </div>
      </div>
    </>
  );
}

function nearby(s: State, g: Group) {
  const out = new Map<string, { f: Feedback; l: Link }>();
  for (const id of g.memberIds) {
    for (const l of linksOf(s, id)) {
      const o = fbOf(s, otherEnd(l, id));
      if (!o || g.memberIds.includes(o.id) || o.status === "ticketed" || l.human === "different") continue;
      if (l.score < 0.45 || l.verdict === "different") continue;
      const prev = out.get(o.id);
      if (!prev || prev.l.score < l.score) out.set(o.id, { f: o, l });
    }
  }
  return [...out.values()].sort((a, b) => b.l.score - a.l.score).slice(0, 3);
}

// ---------- a report ----------

function Who({ s, f }: { s: State; f: Feedback }) {
  const t = testerOf(s, f.testerId);
  const where = stepOf(s, f).step ? `Step ${stepOf(s, f).step!.n}` : f.origin?.page ? (f.origin.page.replace(/^https?:\/\/[^/]+/, "") || "/") : "In the app";
  return (
    <div className="row" style={{ minWidth: 0, gap: 9 }}>
      <Avatar t={t} size="sm" />
      <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{t?.name}</span>
      {f.source !== "tester" && <span className="pill info" style={{ height: 20, flex: "none" }}><Plug size={11} />{f.source === "app" ? "From the app" : "Report a problem"}</span>}
      <span className="small muted clip">{t?.env.browser} · {where} · {ago(f.at)}</span>
    </div>
  );
}

function Reasons({ l }: { l: Link }) {
  return (
    <div className="why-panel">
      <ul className="reasons">
        {l.same.slice(0, 3).map((x) => <li key={x}><Plus size={12} color="var(--green)" strokeWidth={2.6} />{x}</li>)}
        {l.differ.slice(0, 2).map((x) => <li key={x}><Minus size={12} color="var(--orange)" strokeWidth={2.6} />{x}</li>)}
      </ul>
      <p className="small muted" style={{ marginTop: 8 }}>
        From: wording {Math.round(l.textScore * 100)}% alike{l.sameStep ? " · same step" : ""} · {l.by === "model" ? "the model compared both notes" : "rules only"}{l.testerSaid ? " · the tester said it’s the same" : ""}.
      </p>
    </div>
  );
}

function Report({ s, f, g, first: isFirst, act }: { s: State; f: Feedback; g: Group; first: boolean; act: Act }) {
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState(false);
  const best = isFirst ? null : linksOf(s, f.id).find((l) => g.memberIds.includes(otherEnd(l, f.id)));
  const name = first(testerOf(s, f.testerId));
  const answers = f.messages.filter((m) => m.from === "tester");
  const thin = f.analysis?.evidence === "thin";
  return (
    <div className="report">
      <div className="report-head">
        <Who s={s} f={f} />
        <span className="spacer" />
        {f.status === "asked" && <span className="pill warn"><Clock size={11} />Waiting on {name}</span>}
        <span className="hover-actions">
          {g.memberIds.length > 1 && f.status !== "ticketed" && (
            <button className="btn ghost sm" title="Take this report out of the group" onClick={() => act({ action: "split", feedbackId: f.id }, `${name}’s note is now its own case.`, false)}><Split size={13} />Not the same</button>
          )}
          {/* App users have no inbox in Heard, so there is no one to ask. */}
          {f.status === "new" && f.source === "tester" && <button className="btn ghost sm" onClick={() => setAsking(!asking)}><MessageCircleQuestion size={13} />Ask {name}</button>}
          <KindSwitch f={f} act={act} />
        </span>
        {best && (
          <button className="mchip" onClick={() => setWhy(!why)} aria-expanded={why} title={linkLabel(best).text}>
            <Meter value={best.score} tone={linkLabel(best).tone} width={30} />
            <ChevronDown size={12} style={{ transform: why ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </button>
        )}
      </div>
      <div className="quote" style={{ marginTop: 10 }}>{f.text}</div>
      {answers.map((m) => <p key={m.id} className="small" style={{ marginTop: 7 }}><span className="muted">{name} added:</span> {m.text}</p>)}
      {!!f.origin?.errors?.length && <p className="small" style={{ marginTop: 7 }}><span className="muted">Captured by the app:</span> <span className="mono">{f.origin.errors.join(" · ")}</span></p>}
      {thin && !!f.analysis?.missing.length && <p className="small" style={{ marginTop: 7, color: "var(--warn)" }}>Needs a little more: {f.analysis.missing.join(", ")}</p>}
      {why && best && <><div className="small" style={{ marginTop: 10, fontWeight: 500 }}>{linkLabel(best).text} as {first(testerOf(s, fbOf(s, otherEnd(best, f.id))?.testerId ?? ""))}’s note</div><Reasons l={best} /></>}
      {asking && <AskBox s={s} f={f} act={act} onDone={() => setAsking(false)} />}
    </div>
  );
}

function Maybe({ s, f, l, g, act }: { s: State; f: Feedback; l: Link; g: Group; act: Act }) {
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState(false);
  const name = first(testerOf(s, f.testerId));
  const lab = linkLabel(l);
  return (
    <div className="report maybe">
      <div className="report-head">
        <Who s={s} f={f} />
        <span className="spacer" />
        {f.status === "asked" && <span className="pill warn"><Clock size={11} />Waiting on {name}</span>}
        <button className="mchip" onClick={() => setWhy(!why)} aria-expanded={why}>
          <span className="small">{lab.text}</span>
          <Meter value={l.score} tone={lab.tone} width={30} />
          <ChevronDown size={12} style={{ transform: why ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>
      </div>
      <div className="quote" style={{ marginTop: 10 }}>{f.text}</div>
      {why && <Reasons l={l} />}
      <div className="row" style={{ marginTop: 10, gap: 6 }}>
        <button className="btn sm" onClick={() => act({ action: "join", feedbackId: f.id, groupId: g.id }, `Added ${name}’s note to this case.`, false)}><GitMerge size={13} />Same problem — add it</button>
        {f.status === "new" && f.source === "tester" && <button className="btn ghost sm" onClick={() => setAsking(!asking)}><MessageCircleQuestion size={13} />Ask {name} first</button>}
      </div>
      {asking && <AskBox s={s} f={f} act={act} onDone={() => setAsking(false)} />}
    </div>
  );
}

function KindSwitch({ f, act }: { f: Feedback; act: Act }) {
  const k = f.analysis?.kind;
  if (!k || f.status === "ticketed") return null;
  return (
    <label className="btn ghost sm" style={{ position: "relative" }} title={`Heard read this as ${KIND[k].toLowerCase()} (${sureWords(f.analysis!.kindConfidence).toLowerCase()})`}>
      {KIND[k]}
      <ChevronDown size={12} />
      <select aria-label="Change what this is" value="" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
        onChange={(e) => e.target.value && act({ action: "set-kind", feedbackId: f.id, kind: e.target.value }, `Changed to ${KIND[e.target.value as Kind].toLowerCase()} — logged as your call.`, false)}>
        <option value="">Change to…</option>
        {(["bug", "idea", "question", "praise"] as Kind[]).filter((x) => x !== k).map((x) => <option key={x} value={x}>{KIND[x]}</option>)}
      </select>
    </label>
  );
}

function AskBox({ s, f, act, onDone }: { s: State; f: Feedback; act: Act; onDone: () => void }) {
  const [text, setText] = useState(f.analysis?.question ?? "");
  const [options, setOptions] = useState<string[]>(f.analysis?.options ?? []);
  const [busy, setBusy] = useState(!f.analysis?.question);
  const name = first(testerOf(s, f.testerId));
  useEffect(() => {
    if (f.analysis?.question) return;
    post<{ text: string; options: string[] }>("/api/draft", { feedbackId: f.id, purpose: "ask" }).then((r) => { setText(r.text); setOptions(r.options); setBusy(false); }).catch(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="why-panel stack" style={{ marginTop: 10 }}>
      <div className="row"><MessageCircleQuestion size={14} /><b style={{ fontWeight: 500, fontSize: 13 }}>A kind question for {name}</b><span className="spacer" /><span className="small muted">Drafted by Heard — edit freely</span></div>
      <textarea className="textarea" style={{ minHeight: 60 }} value={busy ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} />
      <input className="input" value={options.join("  ·  ")} onChange={(e) => setOptions(e.target.value.split("·").map((x) => x.trim()))} aria-label="One-tap answers" title="One-tap answers they can pick" />
      <div className="row">
        <button className="btn primary sm" disabled={busy || !text.trim()} onClick={async () => { if (await act({ action: "ask", feedbackId: f.id, text, options: options.filter(Boolean) }, `Asked ${name}. Their answer will come back here.`, false)) onDone(); }}>Send to {name}</button>
        <button className="btn ghost sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

// ---------- deciding ----------

type Draft = TicketDraft & { credits: Record<string, string>; by: string };

function TicketPanel({ s, g, members, act }: { s: State; g: Group; members: Feedback[]; act: Act }) {
  const [draft, setDraft] = useState<Draft | null>(g.draft);
  const [d, setD] = useState<TicketDraft | null>(g.draft);
  const [details, setDetails] = useState(false);
  const [replying, setReplying] = useState(false);
  const key = g.memberIds.join(",");

  useEffect(() => {
    if (g.draft) { setDraft(g.draft); setD((cur) => cur ?? g.draft); return; }
    let live = true;
    setDraft(null); setD(null);
    post<Draft>("/api/draft", { groupId: g.id }).then((r) => { if (live) { setDraft(r); setD(r); } }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.id, key]);

  const thin = members.every((f) => f.analysis?.evidence === "thin");
  const asked = members.some((f) => f.status === "asked");
  if (!d || !draft) {
    return <div className="decide-body" style={{ paddingBottom: 16 }}><div className="row"><Dots /><span className="small muted">Drafting the ticket from {members.length === 1 ? "this note" : `${members.length} notes`}…</span></div></div>;
  }
  const set = <K extends keyof TicketDraft>(k: K, v: TicketDraft[K]) => setD({ ...d, [k]: v });
  const changed = (k: keyof TicketDraft) => JSON.stringify(d[k]) !== JSON.stringify(draft[k]);
  const next = `CH-${s.nextTicket}`;
  const edits = (["steps", "expected", "actual", "notes"] as const).filter(changed).length;

  return (
    <>
      <div className="decide-body stack-16">
        <div className="row between"><span className="label">New ticket · {next}</span><span className="small muted row" style={{ gap: 5 }}><Sparkles size={12} />Drafted by Heard</span></div>
        {thin && (
          <div className="ask small">
            <b style={{ fontWeight: 500 }}>Not enough to act on yet.</b> That isn’t a no — {asked ? "a question is with the tester." : "ask one question first; Heard will read the answer into this draft."}
          </div>
        )}
        <textarea className="title-input" rows={2} value={d.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" />
        <div className="field">
          <span className="label">Severity {changed("severity") && <span className="edited">You overruled Heard</span>}</span>
          <div className="seg" role="radiogroup" aria-label="Severity" style={{ marginTop: 8 }}>
            {(["blocker", "major", "minor", "cosmetic"] as Severity[]).map((x) => (
              <button key={x} role="radio" aria-checked={d.severity === x} className={d.severity === x ? "on" : ""} onClick={() => set("severity", x)}>
                {x}{draft.severity === x && <span className="ai">Heard</span>}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>{draft.severityWhy}</p>
        </div>
        <div>
          <button className="details-toggle" onClick={() => setDetails(!details)} aria-expanded={details}>
            <ChevronRight size={14} style={{ transform: details ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
            <span className="grow" style={{ textAlign: "left" }}>Details</span>
            <span className="small muted">{d.steps.filter(Boolean).length} steps · expected · what happened{edits ? ` · ${edits} edited` : ""}</span>
          </button>
          {details && (
            <div className="stack" style={{ marginTop: 10 }}>
              <label className="field"><span className="label">Steps to reproduce</span><textarea className="textarea" rows={Math.min(7, d.steps.length + 1)} value={d.steps.join("\n")} onChange={(e) => set("steps", e.target.value.split("\n"))} /></label>
              <label className="field"><span className="label">Expected</span><textarea className="textarea" style={{ minHeight: 56 }} value={d.expected} onChange={(e) => set("expected", e.target.value)} /></label>
              <label className="field"><span className="label">What happened</span><textarea className="textarea" style={{ minHeight: 70 }} value={d.actual} onChange={(e) => set("actual", e.target.value)} /></label>
              <label className="field"><span className="label">Notes for the developer</span><textarea className="textarea" style={{ minHeight: 56 }} value={d.notes} onChange={(e) => set("notes", e.target.value)} /></label>
            </div>
          )}
        </div>
        {members.length === 1 && (
          <div>
            <button className="link" onClick={() => setReplying(!replying)}>Works as designed? Explain kindly instead</button>
            {replying && <div style={{ marginTop: 10 }}><ReplyBox s={s} f={members[0]!} purpose="not-a-bug" act={act} /></div>}
          </div>
        )}
      </div>
      <div className="decide-foot">
        <button className="btn primary lg block" disabled={!d.title.trim()}
          onClick={() => act({ action: "create-ticket", groupId: g.id, draft: { ...d, severityWhy: draft.severityWhy } }, `${next} created — ${members.length === 1 ? "the tester has" : `all ${members.length} testers have`} been told.`)}>
          <TicketIcon size={15} />Create ticket
        </button>
        <p className="small muted" style={{ textAlign: "center", marginTop: 7 }}>{members.length === 1 ? "The tester is told." : `All ${members.length} testers are told and credited.`}</p>
      </div>
    </>
  );
}

function IdeaPanel({ s, g, members, act }: { s: State; g: Group; members: Feedback[]; act: Act }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    post<{ text: string }>("/api/draft", { feedbackId: members[0]!.id, purpose: "idea" }).then((r) => { if (live) { setText(r.text); setLoading(false); } }).catch(() => setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.id]);
  const who = members.length === 1 ? first(testerOf(s, members[0]!.testerId)) : `all ${members.length} testers`;
  return (
    <>
      <div className="decide-body stack">
        <div className="row between"><span className="label">Ideas backlog</span><span className="small muted row" style={{ gap: 5 }}><Sparkles size={12} />Drafted by Heard</span></div>
        <p className="small muted">Not a ticket — it joins a theme the product team plans from, and everyone who asked is told.</p>
        <label className="field"><span className="label">Message to {who}</span>
          <textarea className="textarea" style={{ minHeight: 120 }} value={loading ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      <div className="decide-foot">
        <button className="btn primary lg block" disabled={loading || !text.trim()} onClick={() => act({ action: "file-idea", groupId: g.id, text }, `Filed in the ideas backlog — ${who} told.`)}><Lightbulb size={15} />File idea and tell {members.length === 1 ? first(testerOf(s, members[0]!.testerId)) : `all ${members.length}`}</button>
      </div>
    </>
  );
}

// ---------- already known ----------

function KnownCase({ s, g, t, fresh, act }: { s: State; g: Group; t: Ticket; fresh: Feedback[]; act: Act }) {
  const l = fresh[0] ? linksOf(s, fresh[0].id).find((x) => t.witnessIds.includes(otherEnd(x, fresh[0]!.id))) : undefined;
  return (
    <>
      <div className="case-title">{t.title}</div>
      <div className="case-meta">Already known · {t.id} · {t.witnessIds.length} {t.witnessIds.length === 1 ? "tester" : "testers"} on the ticket</div>
      <Read parts={[
        { icon: <GitMerge size={13} />, text: <>{l ? linkLabel(l).text : "Looks the same"} as {t.id} {l && <Meter value={l.score} tone={linkLabel(l).tone} width={36} />}</>, why: "Open the report to see the reasons." },
        { icon: <Priority sev={t.severity} size={13} />, text: SEV[t.severity].label, why: t.severityWhy },
      ]} />
      <div className="case-body">
        <div className="stack">{fresh.map((f) => <Report key={f.id} s={s} f={f} g={g} first={false} act={act} />)}</div>
        <div className="decide">
          <div className="decide-body stack" style={{ paddingBottom: 12 }}>
            <span className="label">Add to {t.id}?</span>
            <p className="small muted">The tester is told their note counted, and which ticket it joined.</p>
          </div>
          <div className="decide-foot stack">
            {fresh.map((f) => (
              <div key={f.id} className="row">
                <button className="btn primary grow" onClick={() => act({ action: "add-witness", feedbackId: f.id }, `Added to ${t.id} — ${first(testerOf(s, f.testerId))} has been told.`)}><Check size={14} />Add {first(testerOf(s, f.testerId))}’s note</button>
                <button className="btn" onClick={() => act({ action: "split", feedbackId: f.id }, "It’s its own case now.")}>Not the same</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- questions and praise ----------

function SingleCase({ s, f, act }: { s: State; f: Feedback; act: Act }) {
  const k = f.analysis?.kind ?? "unclear";
  return (
    <>
      <div className="case-title">“{f.text}”</div>
      <div className="case-meta">{KIND[k]} from {testerOf(s, f.testerId)?.name} · {k === "praise" ? "worth passing on" : "a short answer saves a duplicate later"}</div>
      <div className="case-body">
        <div className="report" style={{ alignSelf: "start" }}>
          <div className="report-head"><Who s={s} f={f} /><span className="spacer" /><span className="hover-actions"><KindSwitch f={f} act={act} /></span></div>
          <div className="quote" style={{ marginTop: 10 }}>{f.text}</div>
        </div>
        <div className="decide">
          <div className="decide-body stack" style={{ paddingBottom: 16 }}>
            <span className="label">{k === "praise" ? "Say thank you" : `Answer ${first(testerOf(s, f.testerId))}`}</span>
            <ReplyBox s={s} f={f} purpose={k === "praise" ? "thank" : "answer"} act={act} />
          </div>
        </div>
      </div>
    </>
  );
}

function ReplyBox({ s, f, purpose, act }: { s: State; f: Feedback; purpose: "answer" | "not-a-bug" | "thank"; act: Act }) {
  const needsFacts = purpose !== "thank";
  const [facts, setFacts] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const name = first(testerOf(s, f.testerId));
  async function draft() {
    setBusy(true);
    try { setText((await post<{ text: string }>("/api/draft", { feedbackId: f.id, purpose, reason: facts })).text); } finally { setBusy(false); }
  }
  useEffect(() => { if (!needsFacts) draft(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="stack">
      {needsFacts && (
        <div className="row">
          <input className="input" value={facts} onChange={(e) => setFacts(e.target.value)} placeholder={purpose === "not-a-bug" ? "Why it works this way, in a few words" : "The answer, in a few words"} />
          <button className="btn" disabled={!facts.trim() || busy} onClick={draft} title="Draft a kind reply">{busy ? <Dots /> : <Sparkles size={13} />}Draft</button>
        </div>
      )}
      {(text || !needsFacts) && (
        <>
          <textarea className="textarea" style={{ minHeight: 110 }} value={busy && !text ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} aria-label={`Message to ${name}`} />
          <button className="btn primary block" disabled={!text.trim()} onClick={() => act({ action: purpose === "thank" ? "thank" : "answer", feedbackId: f.id, text }, `Sent to ${name}.`)}>Send to {name}</button>
        </>
      )}
    </div>
  );
}
