# Dumpling

**UAT feedback, neatly folded.**

Testers say what went wrong in their own words. Dumpling folds the same bug, reported five different ways, into one ticket, and asks a kind question when a note is too thin to act on. It keeps every tester posted on what happened to their note. A person decides every step: Dumpling proposes, it never approves.

Dumpling works with any product. The demo workspace is **chalk**, an AI teaching whiteboard, tested in its beta with real flows and labels.

---

## Why

User acceptance testing is the last checkpoint before something ships, and its feedback is messy:

- **The same bug arrives five ways.** Different testers, different words, five tickets for one fix.
- **Comments leave nothing to act on.** "Weird." "Doesn't work." A developer can't start from that.
- **Ideas get lost.** Suggestions sit in spreadsheet cells and nobody plans from them.
- **Testers never hear back.** They gave their time and don't know whether it mattered.

## How it works

Dumpling follows one bug all the way through, from the tester who hits it to the developer who fixes it, and back.

| Who | Where | What happens |
|---|---|---|
| **Tester** | Run tests | A guided runner, one step at a time: *It worked · It didn't work · Something felt off · I have an idea*. Testers write in their own words; browser, device and step are attached for them. While they type, Dumpling says back what it understood, shows whether someone already reported it, and asks **one optional question** if the note is thin. |
| **Tester** | My notes | A tracker for every note (Sent → Understood → Reviewed → Outcome) and the conversation about it. Testers see where each note went: a ticket, the ideas backlog, an answer, or a question waiting for them. |
| **UAT manager** | Review | One case at a time. Reports of the same problem are grouped, with Dumpling's read on one line: how sure it is they're one problem, whether there's enough to act on, and how serious it is. Every match shows its reasons, for and against. Doubtful matches sit outside the group as "Not sure — your call". |
| **Developer** | Tickets | One ticket instead of six duplicates: steps to reproduce, expected vs actual, every reporter's setup and exact words, who drafted it, and who approved it. Copy straight into GitHub or Jira. |
| **Product** | Ideas | Non-bug feedback grouped into themes and counted. Everyone who asked is told where their idea went. |
| **Everyone** | Insights | Where testing hurts (problems per script step), where every note went, whether every tester heard back, and **how often the manager agreed with Dumpling**. Every overrule is kept. |
| **Your app** | Connect your app | One script tag adds a feedback button to any web app, and an intake API takes feedback from your server. Notes from real users land in the same queue, grouped with testers' reports. |

## Workspaces, people and connections

- **Workspaces.** One per product. Create one from the switcher at the top left with the product name, a few words on what it is (Dumpling reads every note with this in mind), a ticket prefix, and where testers open it. Your choice of workspace is remembered per browser, so two people can work in two workspaces at once.
- **People.** Add testers with their browser, OS and device in *Settings › People*; their setup is attached to every note they send. Anyone who has sent notes stays on the record.
- **Test scripts.** Write the steps testers follow, each with what should happen, in *Settings › Test scripts*. Steps that testers have reported on can be reworded but not deleted.
- **Connections.** In *Connect your app*, each workspace can have as many connections as you like (web app, iOS app, support inbox…). Each has its own key, which you can show, copy, rotate (the old key stops working at once) or remove. Feedback is routed to the right workspace by its key alone.

## A person decides every step

These rules are enforced on the server, not just in the interface:

- **No batch approval.** `POST /api/decide` takes exactly one action on one target. Send it a list and it refuses ("One decision at a time").
- **No auto-creation.** Nothing in the reading-and-grouping pipeline creates a ticket, closes a note, or messages a tester beyond an honest "a person reads every note". Tickets exist only through `create-ticket`, which a person presses.
- **Every judgement can be overruled in one click.** Take a note out of a group, add one Dumpling wasn't sure about, change bug ↔ idea ↔ question ↔ praise, or change the severity. A person's call on a pair survives any later re-reading by the model.
- **Uncertainty is shown honestly.** The number shown always agrees with the words shown: a "probably different" can never carry 90%. Confident matches start folded, doubtful ones start open.
- **Thin evidence gets a kinder answer.** It's labelled "needs a little more", never "rejected", and the next step is one five-second question with tap-to-answer options. Dumpling drafts it; the manager edits it and sends it.

## How the AI is used

| Job | How |
|---|---|
| Read a note | Kind (bug / idea / question / praise), confidence, evidence strength, what's missing, one kind follow-up question, severity with a reason, atomic facts. |
| Find duplicates | Embeddings (`text-embedding-3-small`) and the script step pick candidates. The model then compares each pair and gives reasons both ways. Confidence blends three visible signals: how alike the wording is, whether it's the same step, and the model's reading. |
| Draft | Ticket drafts from every report, with what each tester added; short titles; idea themes; replies to testers. All of them are editable, and nothing is sent or created by the model. |

The model is `gpt-5.6-luna` by default (`OPENAI_MODEL` to change it). **Without an API key everything still works**: plain rules take over and say so.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local      # add OPENAI_API_KEY (optional)
npm run dev                     # http://localhost:4100
```

On first run, choose **Open the chalk demo** (or start your own workspace). The demo is the chalk beta cycle: 21 notes from six testers, already read and grouped. Then follow one bug through:

1. **Run tests** as Grace: mark steps 1–2 *It worked*, step 3 *It didn't work*, and type what happened.
2. **Review:** add Femi's note to the case, ask Chen a question, and create the ticket.
3. Switch to Chen (bottom left), open **My notes**, and answer the question. His note joins the case.
4. **Tickets** for the developer's view, **Connect your app** to send feedback from the live widget, then **Ideas** and **Insights**.

The demo data is cached (`data/seed-cache.json`), so a reset is instant and needs no API key.

## Connect your app

**Widget.** Add one line before `</body>`. People write in their own words; the page, their browser and the last few JavaScript errors are attached automatically.

```html
<script src="https://YOUR-DUMPLING/widget.js" data-key="dmp_…" data-app="Your app" async></script>
```

It renders inside a Shadow DOM, so your styles and Dumpling's can't clash. It mounts once even if the script is included twice, and exposes `window.Dumpling.open()`.

**API.** For app-store reviews, support tickets, or anything you already collect:

```bash
curl -X POST https://YOUR-DUMPLING/api/intake \
  -H "Authorization: Bearer dmp_…" \
  -H "Content-Type: application/json" \
  -d '{"text": "The share link asks my friend to sign in", "kind": "problem", "name": "Ada", "page": "/board/123"}'
```

`kind` is `problem`, `idea`, `praise` or `question`. The response is the same honest acknowledgement a tester gets.

## Project layout

```
src/lib/
  types.ts      the whole document model: feedback, links, groups, tickets, decisions
  ai.ts         the model calls (read, compare, draft); falls back to rules without a key
  triage.ts     read → embed → link → group: proposals only
  decide.ts     every human decision; one action, one target, nothing else changes state
  sources.ts    app connections and their keys
  store.ts      one JSON file per workspace; writes queued so decisions never overwrite each other
src/app/
  test/  notes/          tester views
  review/  ideas/  insights/   UAT manager views
  tickets/               developer view
  connect/  settings/  workspaces/new/    workspace
  api/                   route handlers: state, feedback, coach, decide, draft, reply, intake,
                         workspaces, people, scripts, sources, workspace, seed
public/widget.js         the drop-in feedback widget
```

Built with Next.js 16, React 19 and TypeScript; OpenAI for reading and drafting. Storage is one JSON file per workspace (`data/workspaces/`), which is enough for a prototype; it would be a database once hosted.

## Status

A working prototype built for the AI Studio Hackathon's "UAT, Untangled" challenge.

Not built yet:
- sign-in and real roles (today anyone with the URL can switch workspaces and act as tester, manager or developer);
- pushing tickets straight into GitHub or Jira (today you copy them);
- hosted storage.
