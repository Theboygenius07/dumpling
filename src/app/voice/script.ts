// The demo's voiceover, one line per scene. The recording page reads it, and
// the film holds each scene for as long as its recorded line runs.
export const SCENES: { id: string; screen: string; line: string }[] = [
  { id: "cycle", screen: "Title, then the Insights page", line: "Hi, I’m [your name]. I’m building chalk, an AI teaching whiteboard, and it’s in beta — so messy test feedback is my everyday life. This is Dumpling. Twenty-one notes came in from six testers, the way UAT feedback always does: the same bug five ways, and comments with nothing to act on." },
  { id: "tester", screen: "Grace’s test script, steps 1 and 2 pass", line: "Grace is one of our testers. Dumpling walks her through chalk’s test script, one step at a time. Steps one and two worked. Step three didn’t." },
  { id: "typing", screen: "Grace types what happened", line: "So she just says what happened, in her own words. Her browser, her device and the step are attached for her." },
  { id: "coach", screen: "Dumpling replies beside the box as she types", line: "As she types, Dumpling says back what it understood, so she knows she’s been heard. It also spots that others reported something similar — and she confirms it’s the same thing." },
  { id: "sent", screen: "The “Sent — thank you” card", line: "She sends it. The reply is honest: a person reads every note, and she can track what happens to hers." },
  { id: "review", screen: "The review queue, one case open", line: "Now I’m the UAT manager. Each problem is one case, and I decide them one at a time. Dumpling’s read sits on one line: how sure it is these reports are one problem, whether there’s enough to act on, and how serious it is. The testers’ own words sit underneath." },
  { id: "joined femi", screen: "Femi’s note, “Not sure — your call”", line: "Femi’s note looked similar, but Dumpling wasn’t sure, so it left it out and showed me why. I decide it is the same problem. One click." },
  { id: "asked chen", screen: "Chen’s thin note, a drafted question", line: "Chen only wrote: nothing happened when I clicked draw it. That’s thin evidence — but thin isn’t rejected. Dumpling drafts one kind question, and I send it." },
  { id: "chen answered", screen: "Chen answers in My notes", line: "Chen sees the question in My notes and answers in a few seconds. Dumpling reads his note again, and now it backs up the others." },
  { id: "draft", screen: "The drafted ticket, severity changed", line: "Dumpling drafts the ticket from every report: the title, the steps, what was expected and what happened. I can change anything, including overruling the severity." },
  { id: "ticket", screen: "Create ticket is pressed", line: "There’s no approve-all. Every ticket is created by a person, one at a time." },
  { id: "tickets", screen: "The developer’s ticket", line: "The developer gets one clean ticket instead of six duplicates: every tester’s setup and exact words, and a record of who drafted it and who approved it." },
  { id: "chen heard", screen: "Chen’s note tracker, all green", line: "And Chen hears back. His note became a ticket, and the detail he added is in it." },
  { id: "idea", screen: "An idea filed in the backlog", line: "Not everything is a bug. Ideas are gathered into themes and counted, instead of getting lost in a spreadsheet cell — and everyone who asked is told where their idea went." },
  { id: "answered", screen: "A question gets a drafted answer", line: "A question gets a kind answer. Dumpling drafts it from a few words, and nothing is sent until I press send." },
  { id: "connect", screen: "Connect your app, the feedback widget", line: "Feedback doesn’t only come from testers. One line of code adds a feedback button to your app. Here, someone using chalk reports a problem from inside the product." },
  { id: "app note", screen: "That note, in the review queue", line: "It lands in the same queue, folded in with the testers’ reports of the same bug, and tagged with where it came from." },
  { id: "trends", screen: "Insights across the cycle", line: "Across the whole cycle, Dumpling shows where testing hurts, where every note went, whether every tester heard back, and how often I agreed with Dumpling. Trust is earned, not assumed." },
  { id: "ideas", screen: "The ideas backlog, then the end card", line: "chalk is just our first workspace — Dumpling works with any product. Feedback that’s easy to give, easy to act on, with a person in control of every decision. That’s Dumpling." },
];
