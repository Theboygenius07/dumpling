# Heard — UAT, untangled

**Five reports of one bug aren't noise. They're five witnesses.**

Heard is a UAT feedback tool that follows one bug all the way through: from the tester who hits it, to the UAT manager who decides on it, to the developer who fixes it, and back to the tester, who hears what happened. The AI reads, groups and drafts. A person makes every decision.

The test cycle in this prototype is a real one: the beta of **chalk** (trychalk.tech), an AI teaching whiteboard. Its test scripts use chalk's real flows and labels ("Draw it", "Plan my course", "Record"), and Heard can import reports from chalk's own **Report a problem** button.

## The moments it connects

| Moment | Who | What Heard does |
|---|---|---|
| **During** | Tester | Runs scripted steps. When something goes wrong they write in their own words, with no form to fill in. While they type, Heard says back what it understood, says whether someone already reported it ("4 reports · 97% alike · same step"), and asks **one optional question** when the note is thin. Browser, device and step are attached automatically. |
| **After** | UAT manager | A queue that you work **one item at a time**. Notes that describe the same problem are grouped, each with its confidence and its reasons both ways ("+ both stalled at step 3 · – Esme saw a WebSocket error, Bayo didn't"). Doubtful matches sit outside the group as "Not sure — your call". Thin notes get "Ask Chen a question", never "rejected". |
| **Handover** | Developer | One ticket instead of six duplicates: reproduction steps from the script, expected and actual, every witness with their setup and exact words, what each one added, and who approved it and what they edited. You can copy it straight into GitHub or Jira. |
| **Back** | Tester | "My notes" shows where every note went: became ticket CH-101 (with the detail they added credited), filed in the ideas backlog (with how many others asked), answered, or a question waiting for them. |
| **Across the cycle** | Everyone | Where the cycle hurts (failures per script step), how many notes folded into how many problems, whether every tester got a reply from a person, and **how often the manager agreed with Heard**. Every overrule is kept. |

## Connect your app

Feedback doesn't only come from scripted testing. **Connect your app** brings in notes from real use, and they go through the same pipeline and the same one-at-a-time review:

- **Widget:** one script tag adds a Feedback button to any web app. People write in their own words; the page, their browser and the last few JavaScript errors are attached automatically.
  ```html
  <script src="http://localhost:4100/widget.js" data-key="hrd_chalk_demo_4f9a2c" data-app="chalk" async></script>
  ```
- **API:** `POST /api/intake` with `Authorization: Bearer <key>` and `{ text, kind, name, page }`. Use it for app-store reviews, support tickets, or anything else you already collect.
- **chalk's Report a problem:** imported from chalk's own log (`CHALK_REPORTS`).

The demo key is fixed (`HEARD_KEY` overrides it) so that a reset doesn't break a widget already pasted into an app.

## Human control is enforced in code, not just the UI

- **No batch approve.** `/api/decide` takes exactly one action on one target. If you send it a list, it refuses ("One decision at a time.").
- **No auto-creation.** Nothing in the triage pipeline creates a ticket, closes a note, or messages a tester beyond the honest acknowledgement "a person reads every note". Tickets exist only through `create-ticket`, which a person presses.
- **Every judgement is overrulable in one click.** Take a note out of a group, add one Heard wasn't sure about, change bug ↔ idea ↔ question, or change the severity. A person's call on a pair outlives any later re-reading by the model.
- **Uncertainty is shown honestly.** The number shown always agrees with the words shown: a "different" can never carry 90%. Confident matches start folded, and doubtful ones start open, because that is where a person is needed.
- **Thin evidence gets a kinder answer.** It's labelled "Needs a little more", never "rejected", and the next step is a five-second question with one-tap answers, which Heard drafts and the manager sends.

## How it works

- `gpt-5.6-luna` reads each note (kind, confidence, evidence strength, what's missing, a kind question, severity with a reason, atomic facts).
- `text-embedding-3-small` and the script step find candidate matches. The model then compares each pair and gives reasons both ways. Confidence is a blend of three things you can see: how alike the wording is, whether it's the same step, and the model's reading.
- With no API key, plain rules take over and are labelled as rules.
- Storage is one JSON file (`data/store.json`). The seed cycle is read by the model once and cached (`data/seed-cache.json`), so **Reset demo** is instant.

## Run it

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
# optional: chalk's Report a problem log (a Mac without accounts writes it here)
echo "CHALK_REPORTS=/path/to/chalk/.data/support.jsonl" >> .env.local
npm run dev        # http://localhost:4100
```

Open **Insights** and press **Reset demo** to load chalk's beta cycle. Then:

1. **Run tests** (as Grace): pass steps 1–2, mark step 3 *It didn't work*, and type what happened.
2. **Review**: add Femi's note, ask Chen a question, and create the ticket.
3. Switch to Chen (bottom left), open **My notes**, answer the question, and watch his note join the others.
4. **Tickets**: the developer's view. **Connect your app**: send feedback from the live widget. **Ideas** and **Insights**: the backlog and the trends.
