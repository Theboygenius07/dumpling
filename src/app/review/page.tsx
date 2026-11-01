"use client";
import { useEffect, useMemo, useState } from "react";
import type { Feedback, Group, Kind, Link, Severity, Ticket, TicketDraft } from "@/lib/types";
import {
  Avatar, EVIDENCE, KIND, Loading, Meter, SEV_TONE, ago, fbOf, linkLabel, linksOf, otherEnd, post, stepOf, sureWords, testerOf, useStore, useToast, type State,
} from "../ui";

type Item =
  | { type: "group"; id: string; g: Group; members: Feedback[]; family: "bug" | "idea" }
  | { type: "known"; id: string; g: Group; t: Ticket; fresh: Feedback[] }
  | { type: "single"; id: string; f: Feedback };

const SEV_W: Record<Severity, number> = { blocker: 4, major: 3, minor: 2, cosmetic: 1 };
const fam = (k?: Kind) => (k === "bug" || k === "unclear" ? "bug" : k === "idea" ? "idea" : null);

function queue(s: State): Item[] {
  const items: (Item & { rank: number })[] = [];
  for (const g of s.groups) {
    const members = g.memberIds.map((id) => fbOf(s, id)!).filter(Boolean);
    const fresh = members.filter((f) => f.status === "new");
    if (!fresh.length) continue;
    if (g.status === "ticketed") {
      const t = s.tickets.find((x) => x.id === g.ticketId);
      if (t) items.push({ type: "known", id: g.id, g, t, fresh, rank: 50 });
      continue;
    }
    if (g.status !== "open") continue;
    const family = fam(members[0]?.analysis?.kind) ?? "bug";
    const sev = Math.max(...members.map((f) => SEV_W[f.analysis?.severity ?? "minor"]));
    const thin = members.every((f) => f.analysis?.evidence === "thin");
    items.push({ type: "group", id: g.id, g, members, family, rank: family === "bug" ? sev * 10 + members.length * 4 - (thin ? 15 : 0) : 8 + members.length });
  }
  for (const f of s.feedback) {
    if (f.status !== "new" || f.groupId) continue;
    items.push({ type: "single", id: f.id, f, rank: f.analysis?.kind === "question" ? 6 : 3 });
  }
  return items.sort((a, b) => b.rank - a.rank);
}

export default function ReviewPage() {
  const { s, empty, refresh } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const { toast, Toast } = useToast();
  const items = useMemo(() => (s ? queue(s) : []), [s]);
  const current = items.find((i) => i.id === sel) ?? items[0];
  if (!s) return <Loading empty={empty} />;
  const waiting = s.feedback.filter((f) => f.status === "asked");
  const decided = s.decisions.length;

  async function act(body: object, done: string, next = true) {
    const was = sel;
    try {
      await post("/api/decide", body);
      const fresh = await refresh();
      toast(done);
      // Move on only if they're still looking at the item they decided.
      if (next && fresh) setSel((cur) => (cur === was ? null : cur));
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="row wrap" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="eyebrow">{s.cycle.name} · {s.manager}</div>
          <h1 style={{ marginTop: 4 }}>Review, one at a time</h1>
          <p className="lede">Heard reads every note, groups the ones that look like the same problem and drafts the ticket. You decide each one — there is no approve-all, and nothing becomes a ticket on its own.</p>
        </div>
        <div className="row">
          <div className="stat" style={{ padding: "10px 14px" }}><div className="v" style={{ fontSize: 24 }}>{items.length}</div><div className="l">to decide</div></div>
          <div className="stat" style={{ padding: "10px 14px" }}><div className="v" style={{ fontSize: 24 }}>{waiting.length}</div><div className="l">with testers</div></div>
          <div className="stat" style={{ padding: "10px 14px" }}><div className="v" style={{ fontSize: 24 }}>{decided}</div><div className="l">decisions made</div></div>
        </div>
      </div>

      <div className="split-3">
        <aside className="list sticky" style={{ paddingBottom: 12 }}>
          {items.map((i) => <QueueRow key={i.id} s={s} i={i} on={current?.id === i.id} onClick={() => setSel(i.id)} />)}
          {!items.length && <div className="card empty">Nothing waiting. Every note has had a person’s decision.</div>}
          {waiting.length > 0 && (
            <div className="card flat small" style={{ marginTop: 8 }}>
              <div className="eyebrow">Waiting on testers</div>
              {waiting.map((f) => (
                <div key={f.id} className="row" style={{ marginTop: 8 }}>
                  <Avatar t={testerOf(s, f.testerId)} sm />
                  <span className="grow">{testerOf(s, f.testerId)?.name.split(" ")[0]}: “{f.text.slice(0, 40)}”</span>
                </div>
              ))}
            </div>
          )}
        </aside>
        {current ? <Detail key={current.id} s={s} item={current} act={act} /> : <div className="card empty" style={{ gridColumn: "2 / -1" }}>All clear.</div>}
      </div>
      <Toast />
    </div>
  );
}

function QueueRow({ s, i, on, onClick }: { s: State; i: Item; on: boolean; onClick: () => void }) {
  let chips: React.ReactNode;
  let title: string;
  if (i.type === "group") {
    const sev = i.members.map((f) => f.analysis?.severity ?? "minor").sort((a, b) => SEV_W[b] - SEV_W[a])[0]!;
    const thin = i.members.every((f) => f.analysis?.evidence === "thin");
    chips = (
      <>
        <span className={`chip ${i.family}`}>{i.family === "bug" ? (i.members.some((f) => f.analysis?.kind === "unclear") && i.members.length === 1 ? "Not sure yet" : "Bug") : "Idea"}</span>
        {i.members.length > 1 && <span className="chip ink">{i.members.length} reports</span>}
        {i.family === "bug" && <span className={`chip ${SEV_TONE[sev]}`}>{sev}</span>}
        {thin && <span className="chip warn">needs more</span>}
      </>
    );
    title = i.g.draft?.title ?? i.g.title;
  } else if (i.type === "known") {
    chips = (<><span className="chip good">Already known</span><span className="chip line">{i.t.id}</span></>);
    title = `${i.fresh.length} new report${i.fresh.length > 1 ? "s" : ""} for “${i.t.title}”`;
  } else {
    const k = i.f.analysis?.kind ?? "unclear";
    chips = <span className={`chip ${k}`}>{KIND[k]}</span>;
    title = i.f.analysis?.summary ?? i.f.text;
  }
  return (
    <button className={`item ${on ? "on" : ""}`} onClick={onClick}>
      <div className="row wrap">{chips}</div>
      <div className="t">{title}</div>
    </button>
  );
}

type Act = (body: object, done: string, next?: boolean) => Promise<void>;

function Detail({ s, item, act }: { s: State; item: Item; act: Act }) {
  if (item.type === "single") return <Single s={s} f={item.f} act={act} />;
  if (item.type === "known") return <Known s={s} g={item.g} t={item.t} fresh={item.fresh} act={act} />;
  return <GroupView s={s} g={item.g} members={item.members} family={item.family} act={act} />;
}

// ---------- a group of notes that look like one problem ----------

function GroupView({ s, g, members, family, act }: { s: State; g: Group; members: Feedback[]; family: "bug" | "idea"; act: Act }) {
  const near = useMemo(() => nearby(s, g), [s, g]);
  return (
    <>
      <section className="stack">
        <div className="card">
          <div className="row wrap">
            <span className={`chip ${family}`}>{family === "bug" ? "Bug" : "Idea"}</span>
            <span className="chip line">{members.length} {members.length === 1 ? "report" : "reports"} · {new Set(members.map((m) => m.testerId)).size} {new Set(members.map((m) => m.testerId)).size === 1 ? "tester" : "testers"}</span>
            <span className="chip line">{[...new Set(members.map((m) => testerOf(s, m.testerId)?.env.browser.split(" ")[0]))].join(" · ")}</span>
          </div>
          <h2 style={{ marginTop: 10 }}>{g.draft?.title ?? g.title}</h2>
          {members.length > 1 && (
            <p className="why" style={{ marginTop: 6 }}>
              Heard grouped these because they describe one problem in different words. {members.length} reports of one bug aren’t noise — they’re {members.length} witnesses. Take any out with one click.
            </p>
          )}
        </div>
        {members.map((f, i) => (
          <Witness key={f.id} s={s} f={f} g={g} first={i === 0} act={act} />
        ))}
        {near.length > 0 && (
          <div className="stack-sm">
            <div className="eyebrow" style={{ marginTop: 6 }}>Might belong here — Heard isn’t sure</div>
            {near.map(({ f, l }) => (
              <Candidate key={f.id} s={s} f={f} l={l} g={g} act={act} />
            ))}
          </div>
        )}
      </section>
      <aside className="sticky stack">
        {family === "bug" ? <TicketPanel s={s} g={g} members={members} act={act} /> : <IdeaPanel s={s} g={g} members={members} act={act} />}
      </aside>
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

function Witness({ s, f, g, first, act }: { s: State; f: Feedback; g: Group; first: boolean; act: Act }) {
  const t = testerOf(s, f.testerId);
  const a = f.analysis;
  const [asking, setAsking] = useState(false);
  const best = first ? null : linksOf(s, f.id).find((l) => g.memberIds.includes(otherEnd(l, f.id)));
  const bestOther = best ? fbOf(s, otherEnd(best, f.id)) : undefined;
  return (
    <div className="card fade-in">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="who">
          <Avatar t={t} />
          <div>
            <b>{t?.name}</b>
            <div className="small muted">{t?.env.browser} · {t?.env.device} · {stepOf(s, f).label} · {ago(f.at)}</div>
          </div>
        </div>
        {f.source === "chalk-report" && <span className="chip accent">From chalk’s Report a problem</span>}
      </div>
      <div className="quote" style={{ marginTop: 10 }}>{f.text}</div>
      {f.messages.filter((m) => m.from === "tester").map((m) => (
        <div key={m.id} className="msg tester" style={{ marginTop: 6, marginLeft: 0 }}><div className="from">Their answer to your question</div>{m.text}</div>
      ))}
      {a && (
        <div className="row wrap small" style={{ marginTop: 10 }}>
          <span className={`chip ${a.kind}`}>{KIND[a.kind]}</span>
          <span className="muted">Heard is {sureWords(a.kindConfidence)} ({Math.round(a.kindConfidence * 100)}%)</span>
          <span className={`chip ${EVIDENCE[a.evidence].tone}`}>{EVIDENCE[a.evidence].label}</span>
          {a.facts.slice(0, 3).map((x) => <span key={x} className="chip line">{x}</span>)}
        </div>
      )}
      {a && a.evidence !== "strong" && a.missing.length > 0 && (
        <p className="small muted" style={{ marginTop: 6 }}>Still missing: {a.missing.join(" · ")}</p>
      )}
      {best && bestOther && <LinkWhy s={s} l={best} other={bestOther} />}
      <div className="row wrap" style={{ marginTop: 12 }}>
        {g.memberIds.length > 1 && f.status !== "ticketed" && (
          <button className="btn sm" onClick={() => act({ action: "split", feedbackId: f.id }, `Taken out — ${t?.name.split(" ")[0]}’s note is now on its own.`, false)}>Not the same — take it out</button>
        )}
        {f.status === "new" && <button className="btn sm" onClick={() => setAsking(!asking)}>Ask {t?.name.split(" ")[0]} a question</button>}
        {f.status === "asked" && <span className="chip warn">Waiting on {t?.name.split(" ")[0]}’s answer</span>}
        <KindSwitch f={f} act={act} />
      </div>
      {asking && <AskBox s={s} f={f} act={act} onDone={() => setAsking(false)} />}
    </div>
  );
}

function LinkWhy({ s, l, other }: { s: State; l: Link; other: Feedback }) {
  const lab = linkLabel(l);
  // Confident calls start folded; doubtful ones open, because that is where a person is needed.
  const doubtful = l.verdict !== "same" || l.score < 0.8;
  return (
    <details className="card flat why-box" style={{ marginTop: 10 }} open={doubtful}>
      <summary className="row wrap" style={{ justifyContent: "space-between" }}>
        <span className="small"><b>{lab.text}</b> as {testerOf(s, other.testerId)?.name.split(" ")[0]}’s note</span>
        <Meter value={l.score} tone={lab.tone} />
      </summary>
      <div className="why" style={{ marginTop: 6 }}>
        <ul>
          {l.same.slice(0, 3).map((x) => <li key={x} className="plus">{x}</li>)}
          {l.differ.slice(0, 2).map((x) => <li key={x} className="minus">{x}</li>)}
        </ul>
        <p className="small muted" style={{ marginTop: 6 }}>
          How this was worked out: wording {Math.round(l.textScore * 100)}% alike{l.sameStep ? " · same step" : ""} · {l.by === "model" ? "the model compared both notes" : "rules only (no model)"}{l.testerSaid ? " · the tester said it’s the same" : ""}.
        </p>
      </div>
    </details>
  );
}

function Candidate({ s, f, l, g, act }: { s: State; f: Feedback; l: Link; g: Group; act: Act }) {
  const t = testerOf(s, f.testerId);
  const other = fbOf(s, otherEnd(l, f.id))!;
  const [asking, setAsking] = useState(false);
  return (
    <div className="card" style={{ borderStyle: "dashed" }}>
      <div className="who">
        <Avatar t={t} sm />
        <b>{t?.name}</b>
        <span className="small muted">{t?.env.browser} · {stepOf(s, f).label}</span>
      </div>
      <div className="quote" style={{ marginTop: 8 }}>{f.text}</div>
      <LinkWhy s={s} l={l} other={other} />
      <div className="row wrap" style={{ marginTop: 10 }}>
        <button className="btn sm ink" onClick={() => act({ action: "join", feedbackId: f.id, groupId: g.id }, `Added ${t?.name.split(" ")[0]}’s note to this group.`, false)}>It’s the same — add it</button>
        {f.status === "new" && <button className="btn sm" onClick={() => setAsking(!asking)}>Ask {t?.name.split(" ")[0]} first</button>}
        {f.status === "asked" && <span className="chip warn">Waiting on {t?.name.split(" ")[0]}’s answer</span>}
      </div>
      {asking && <AskBox s={s} f={f} act={act} onDone={() => setAsking(false)} />}
    </div>
  );
}

function KindSwitch({ f, act }: { f: Feedback; act: Act }) {
  const k = f.analysis?.kind;
  if (!k || f.status === "ticketed") return null;
  return (
    <select
      className="btn sm"
      style={{ width: "auto", padding: "5px 8px" }}
      value=""
      onChange={(e) => e.target.value && act({ action: "set-kind", feedbackId: f.id, kind: e.target.value }, `Changed to ${KIND[e.target.value as Kind].toLowerCase()} — Heard will remember you overruled it.`, false)}
    >
      <option value="">Heard says {KIND[k].toLowerCase()} — change…</option>
      {(["bug", "idea", "question", "praise"] as Kind[]).filter((x) => x !== k).map((x) => <option key={x} value={x}>It’s {x === "idea" ? "an" : "a"} {KIND[x].toLowerCase()}</option>)}
    </select>
  );
}

// ---------- the draft ticket ----------

function TicketPanel({ s, g, members, act }: { s: State; g: Group; members: Feedback[]; act: Act }) {
  const [draft, setDraft] = useState<(TicketDraft & { credits: Record<string, string>; by: string }) | null>(g.draft);
  const [d, setD] = useState<TicketDraft | null>(g.draft);
  const [loading, setLoading] = useState(!g.draft);
  const [replying, setReplying] = useState(false);
  const key = g.memberIds.join(",");

  useEffect(() => {
    if (g.draft) { setDraft(g.draft); setD(g.draft); setLoading(false); return; }
    let live = true;
    setLoading(true);
    post<TicketDraft & { credits: Record<string, string>; by: string }>("/api/draft", { groupId: g.id }).then((r) => {
      if (!live) return;
      setDraft(r);
      setD(r);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.id, key]);

  const allThin = members.every((f) => f.analysis?.evidence === "thin");
  const asked = members.some((f) => f.status === "asked");
  if (loading || !d || !draft) {
    return <div className="card"><div className="row"><span className="dots"><i /><i /><i /></span> <span className="muted">Heard is drafting the ticket from {members.length} {members.length === 1 ? "note" : "notes"}…</span></div></div>;
  }
  const set = <K extends keyof TicketDraft>(k: K, v: TicketDraft[K]) => setD({ ...d, [k]: v });
  const changed = (k: keyof TicketDraft) => JSON.stringify(d[k]) !== JSON.stringify(draft[k]);
  const next = `CH-${s.nextTicket}`;

  return (
    <div className="card stack">
      <div className="panel-title" style={{ marginBottom: 0 }}>
        <h3>Draft ticket</h3>
        <span className="chip line">{draft.by === "model" ? "Drafted by Heard — edit anything" : "Drafted by rules"}</span>
      </div>
      {allThin && (
        <div className="card flat small">
          <b>Not enough to act on yet.</b> That isn’t a no — {asked ? "a question is with the tester." : "ask the tester one kind question, and Heard will read their answer into this draft."}
        </div>
      )}
      <label className="field"><span>Title {changed("title") && <em className="muted">· edited</em>}</span>
        <input type="text" value={d.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <label className="field"><span>Severity {changed("severity") && <em className="muted">· you overruled Heard ({draft.severity})</em>}</span>
        <select value={d.severity} onChange={(e) => set("severity", e.target.value as Severity)}>
          {(["blocker", "major", "minor", "cosmetic"] as Severity[]).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <p className="small muted" style={{ marginTop: -6 }}>Heard’s reason: {draft.severityWhy}</p>
      <label className="field"><span>Steps to reproduce</span>
        <textarea rows={Math.min(7, d.steps.length + 1)} value={d.steps.join("\n")} onChange={(e) => set("steps", e.target.value.split("\n"))} />
      </label>
      <div className="grid-2">
        <label className="field"><span>Expected</span><textarea rows={3} value={d.expected} onChange={(e) => set("expected", e.target.value)} /></label>
        <label className="field"><span>What happened</span><textarea rows={3} value={d.actual} onChange={(e) => set("actual", e.target.value)} /></label>
      </div>
      <label className="field"><span>Notes for the developer</span><textarea rows={2} value={d.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      {Object.keys(draft.credits ?? {}).length > 0 && (
        <div>
          <div className="small muted">What each report adds</div>
          <div className="stack-sm" style={{ marginTop: 6 }}>
            {members.map((f) => draft.credits[f.id] ? (
              <div key={f.id} className="row small"><Avatar t={testerOf(s, f.testerId)} sm /><span className="grow">{draft.credits[f.id]}</span></div>
            ) : null)}
          </div>
        </div>
      )}
      <div className="sep" style={{ margin: "4px 0" }} />
      <button
        className="btn primary lg"
        disabled={!d.title.trim()}
        onClick={() => act({ action: "create-ticket", groupId: g.id, draft: { ...d, severityWhy: draft.severityWhy } }, `${next} created — ${members.length === 1 ? "the tester has" : `all ${members.length} testers have`} been told.`)}
      >
        Create ticket {next}
      </button>
      <p className="small muted" style={{ marginTop: -4 }}>One ticket from {members.length === 1 ? "this note" : `these ${members.length} notes`}. Each tester is told, and credited for what they added.</p>
      {members.length === 1 && (
        <>
          <button className="btn quiet sm" onClick={() => setReplying(!replying)}>It works as designed — explain kindly instead</button>
          {replying && <ReplyBox s={s} f={members[0]!} purpose="not-a-bug" act={act} />}
        </>
      )}
    </div>
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
  return (
    <div className="card stack">
      <div className="panel-title" style={{ marginBottom: 0 }}>
        <h3>File in the ideas backlog</h3>
        <span className="chip idea">not a ticket</span>
      </div>
      <p className="small">Ideas don’t get lost in a spreadsheet cell — they’re grouped into themes the product team plans from, and every tester who asked is counted.</p>
      <label className="field"><span>Message to {members.length === 1 ? testerOf(s, members[0]!.testerId)?.name.split(" ")[0] : `all ${members.length} testers`}</span>
        <textarea rows={4} value={loading ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button className="btn primary lg" disabled={loading || !text.trim()} onClick={() => act({ action: "file-idea", groupId: g.id, text }, "Filed in the ideas backlog — testers told.")}>File idea and tell {members.length === 1 ? "them" : `all ${members.length}`}</button>
    </div>
  );
}

// ---------- already known ----------

function Known({ s, g, t, fresh, act }: { s: State; g: Group; t: Ticket; fresh: Feedback[]; act: Act }) {
  return (
    <>
      <section className="stack">
        <div className="card">
          <div className="row wrap"><span className="chip good">Already known</span><span className="chip line">{t.id} · {t.severity}</span></div>
          <h2 style={{ marginTop: 10 }}>{t.title}</h2>
          <p className="why" style={{ marginTop: 6 }}>A new note looks like a bug that already has a ticket. Adding it tells the developer it’s still happening, and on which setup — and tells the tester their note counted.</p>
        </div>
        {fresh.map((f) => <Witness key={f.id} s={s} f={f} g={g} first={false} act={act} />)}
      </section>
      <aside className="sticky stack">
        <div className="card stack">
          <h3>Add to {t.id}?</h3>
          <p className="small muted">{t.witnessIds.length} people on the ticket already.</p>
          {fresh.map((f) => (
            <div key={f.id} className="row wrap">
              <button className="btn primary" onClick={() => act({ action: "add-witness", feedbackId: f.id }, `Added to ${t.id} — ${testerOf(s, f.testerId)?.name.split(" ")[0]} has been told.`)}>Add {testerOf(s, f.testerId)?.name.split(" ")[0]}’s note</button>
              <button className="btn" onClick={() => act({ action: "split", feedbackId: f.id }, "Taken out — it’s on its own now.")}>Not the same</button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

// ---------- questions and praise ----------

function Single({ s, f, act }: { s: State; f: Feedback; act: Act }) {
  const t = testerOf(s, f.testerId);
  const k = f.analysis?.kind ?? "unclear";
  return (
    <>
      <section className="stack">
        <div className="card">
          <div className="row wrap"><span className={`chip ${k}`}>{KIND[k]}</span></div>
          <h2 style={{ marginTop: 10 }}>{f.analysis?.summary ?? f.text}</h2>
          <p className="why" style={{ marginTop: 6 }}>{k === "question" ? "Not a bug — a tester is unsure how something works. A quick answer now saves a duplicate later, and often points at something to make clearer." : "Not a bug, but worth hearing: what testers love is what the team should protect."}</p>
        </div>
        <div className="card">
          <div className="who"><Avatar t={t} /><div><b>{t?.name}</b><div className="small muted">{t?.env.browser} · {stepOf(s, f).label} · {ago(f.at)}</div></div></div>
          <div className="quote" style={{ marginTop: 10 }}>{f.text}</div>
          {f.analysis && <p className="small muted" style={{ marginTop: 8 }}>Heard is {sureWords(f.analysis.kindConfidence)} this is {k === "praise" ? "praise" : `a ${KIND[k].toLowerCase()}`}: {f.analysis.kindWhy}</p>}
          <div className="row" style={{ marginTop: 10 }}><KindSwitch f={f} act={act} /></div>
        </div>
      </section>
      <aside className="sticky stack">
        <div className="card stack">
          <h3>{k === "praise" ? "Say thank you" : "Answer them"}</h3>
          <ReplyBox s={s} f={f} purpose={k === "praise" ? "thank" : "answer"} act={act} />
        </div>
      </aside>
    </>
  );
}

function ReplyBox({ s, f, purpose, act }: { s: State; f: Feedback; purpose: "answer" | "not-a-bug" | "thank"; act: Act }) {
  const needsFacts = purpose !== "thank";
  const [facts, setFacts] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const name = testerOf(s, f.testerId)?.name.split(" ")[0];
  async function draft() {
    setBusy(true);
    try {
      const r = await post<{ text: string }>("/api/draft", { feedbackId: f.id, purpose, reason: facts });
      setText(r.text);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { if (!needsFacts) draft(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="stack-sm">
      {needsFacts && (
        <>
          <label className="field"><span>{purpose === "not-a-bug" ? "Why does it work this way? (a few words)" : "What’s the answer? (a few words)"}</span>
            <input type="text" value={facts} onChange={(e) => setFacts(e.target.value)} placeholder={purpose === "not-a-bug" ? "e.g. on purpose, because…" : "e.g. yes, it saves as you go"} />
          </label>
          <button className="btn sm" disabled={!facts.trim() || busy} onClick={draft}>{busy ? "Drafting…" : "Draft a kind reply"}</button>
        </>
      )}
      {(text || !needsFacts) && (
        <>
          <label className="field"><span>Message to {name}</span><textarea rows={4} value={busy && !text ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} /></label>
          <button className="btn primary" disabled={!text.trim()} onClick={() => act({ action: purpose === "thank" ? "thank" : "answer", feedbackId: f.id, text }, `Sent to ${name}.`)}>Send to {name}</button>
        </>
      )}
    </div>
  );
}

function AskBox({ s, f, act, onDone }: { s: State; f: Feedback; act: Act; onDone: () => void }) {
  const [text, setText] = useState(f.analysis?.question ?? "");
  const [options, setOptions] = useState<string[]>(f.analysis?.options ?? []);
  const [busy, setBusy] = useState(!f.analysis?.question);
  const name = testerOf(s, f.testerId)?.name.split(" ")[0];
  useEffect(() => {
    if (f.analysis?.question) return;
    post<{ text: string; options: string[] }>("/api/draft", { feedbackId: f.id, purpose: "ask" }).then((r) => { setText(r.text); setOptions(r.options); setBusy(false); }).catch(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="card flat stack-sm fade-in" style={{ marginTop: 10 }}>
      <div className="small muted">A kind question — Heard drafted it, you send it</div>
      <textarea rows={2} value={busy ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} />
      <input type="text" value={options.join(" · ")} onChange={(e) => setOptions(e.target.value.split("·").map((x) => x.trim()))} placeholder="One-tap answers, separated by ·" />
      <div className="row">
        <button className="btn primary sm" disabled={busy || !text.trim()} onClick={async () => { await act({ action: "ask", feedbackId: f.id, text, options: options.filter(Boolean) }, `Asked ${name}. Their answer comes back here.`, false); onDone(); }}>Send to {name}</button>
        <button className="btn quiet sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
