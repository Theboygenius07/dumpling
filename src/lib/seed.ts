import type { Feedback, Script, Store, Tester, Verdict } from "./types";

// The product under test is chalk (trychalk.tech): a real UAT cycle for its
// beta, written against chalk's real labels ("Draw it", "Plan my course",
// "Record"). The feedback below is invented, but it is messy the way the
// brief says real feedback is: one bug arrives five ways, comments leave
// nothing to act on, ideas get lost among bugs.

export const testers: Tester[] = [
  { id: "t_ada", name: "Ada Okafor", env: { browser: "Chrome 141", os: "macOS 26", device: "MacBook Air" } },
  { id: "t_bayo", name: "Bayo Adeyemi", env: { browser: "Safari 26", os: "macOS 26", device: "MacBook Pro" } },
  { id: "t_chen", name: "Chen Wei", env: { browser: "Edge 141", os: "Windows 11", device: "Surface Laptop" } },
  { id: "t_dami", name: "Dami Bello", env: { browser: "Chrome 141", os: "Windows 11", device: "Dell XPS" } },
  { id: "t_esme", name: "Esme Hart", env: { browser: "Firefox 144", os: "Windows 11", device: "ThinkPad" } },
  { id: "t_femi", name: "Femi Lawal", env: { browser: "Safari 26", os: "iPadOS 26", device: "iPad Air" } },
  { id: "t_grace", name: "Grace Mensah", env: { browser: "Safari 26", os: "macOS 26", device: "MacBook Air" } },
];

export const scripts: Script[] = [
  {
    id: "s_board",
    title: "Draw your first board",
    area: "Board",
    steps: [
      { id: "b1", n: 1, action: "Sign in with the six-digit code chalk emails you.", expected: "You land on Home within a minute of asking for the code." },
      { id: "b2", n: 2, action: "Type “How do vaccines train the immune system?” and press Draw it.", expected: "The cursor starts placing the first section within 10 seconds." },
      { id: "b3", n: 3, action: "Wait for the board to finish drawing.", expected: "Every section appears with its diagrams, and chalk offers the walkthrough." },
      { id: "b4", n: 4, action: "Press play on the walkthrough.", expected: "The cursor walks each section in order and reads it aloud." },
      { id: "b5", n: 5, action: "Circle one diagram with the pen and ask “what does this mean?”", expected: "The answer is about the part you circled, and the circle stays visible while it answers." },
      { id: "b6", n: 6, action: "Press Share and open the link in a private window.", expected: "The board opens for someone who is not signed in." },
    ],
  },
  {
    id: "s_course",
    title: "Plan a course",
    area: "Learn",
    steps: [
      { id: "c1", n: 1, action: "Open Learn, press Plan my course and enter “Intro to statistics”.", expected: "A course plan with lessons appears." },
      { id: "c2", n: 2, action: "Open lesson 1.", expected: "The lesson opens on a board and starts teaching." },
      { id: "c3", n: 3, action: "Finish the quiz at the end of the lesson.", expected: "You see your score and which answers were wrong." },
    ],
  },
  {
    id: "s_record",
    title: "Record a class",
    area: "Record",
    steps: [
      { id: "r1", n: 1, action: "Press Record and allow the microphone.", expected: "A timer starts counting." },
      { id: "r2", n: 2, action: "Talk for about a minute, then press Stop.", expected: "Notes of what you said appear within two minutes." },
      { id: "r3", n: 3, action: "Open Settings › Plan & usage.", expected: "This week’s credits are shown." },
    ],
  },
];

type Raw = [tester: string, script: string | null, step: string | null, verdict: Verdict, text: string, minutesAgo: number];

// Grouped here for the reader; the tool never sees this grouping.
const raw: Raw[] = [
  // One bug, five ways: the board never finishes drawing on Safari.
  ["t_bayo", "s_board", "b3", "failed", "Pressed Draw it, the little cursor moved around for ages and nothing ever came up on the board. I waited about 3 minutes then gave up.", 410],
  ["t_femi", "s_board", "b3", "failed", "stuck loading", 380],
  ["t_esme", "s_board", "b3", "failed", "Board never finished. The cursor kept circling and no sections appeared. Console showed “WebSocket closed (1006)” right before it stalled.", 300],
  ["t_chen", "s_board", "b2", "failed", "nothing happened when i clicked draw it", 260],
  ["t_ada", "s_board", "b3", "off", "The board took forever — first section showed up after about 40 seconds, but then the rest came and it finished fine.", 240],
  ["t_femi", "s_board", "b2", "failed", "Tried again on the iPad. Cursor appears, then it just sits there. Same thing happened yesterday.", 120],

  // Share link asks a signed-out person to sign in.
  ["t_ada", "s_board", "b6", "failed", "The share link asks my friend to sign in instead of showing the board.", 230],
  ["t_dami", "s_board", "b6", "failed", "Sent the link to my sister, she got a sign-in page. Opened it myself in incognito: same, “Sign in to chalk”.", 150],

  ["t_chen", "s_board", "b4", "failed", "If you press play twice the narration starts again on top of itself, two voices at once.", 200],
  ["t_esme", "s_board", "b5", "failed", "I circled the graph but the answer explained the table next to it instead.", 190],
  ["t_dami", "s_course", "c3", "failed", "Quiz said 0/5 but I'm sure at least 3 were right — when I opened the answers, my picks were marked green.", 140],
  ["t_bayo", "s_record", "r2", "failed", "The notes stop before the end — the last thing I said (about 20 seconds) is missing.", 100],

  // Thin evidence: nothing to act on yet.
  ["t_chen", "s_course", "c1", "off", "weird", 170],
  ["t_femi", "s_record", "r1", "failed", "doesn't work", 90],

  // Not a bug: chalk shows credits in Settings only, on purpose.
  ["t_femi", "s_record", "r3", "off", "I couldn't see how many credits the board cost anywhere on the board itself, I had to go to settings.", 80],

  // Ideas, not bugs.
  ["t_ada", "s_board", "b3", "idea", "Would love to export the board as a PDF to hand out.", 220],
  ["t_chen", null, null, "idea", "Can I print a board for my class? Some of my students don't have laptops.", 160],
  ["t_esme", null, null, "idea", "Dark mode please — I study at night.", 130],
  ["t_dami", "s_board", "b4", "idea", "Let me pick the narrator's voice, a slower one would help me.", 110],

  // A question, and praise.
  ["t_dami", "s_board", "b3", "off", "Is the board saved automatically or do I need to press something?", 70],
  ["t_bayo", "s_board", "b4", "worked", "Honestly the walkthrough cursor is delightful, it feels like someone is teaching me.", 60],
];

export function seed(): Store {
  const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const feedback: Feedback[] = raw.map(([testerId, scriptId, stepId, verdict, text, m], i) => ({
    id: `f_${String(i + 1).padStart(2, "0")}`,
    testerId,
    scriptId,
    stepId,
    verdict,
    text,
    at: at(m),
    source: "tester",
    sameAs: null,
    analysis: null,
    status: "new",
    groupId: null,
    ticketId: null,
    messages: [],
  }));
  return {
    cycle: {
      id: "cy_1",
      name: "chalk beta · UAT cycle 1",
      product: "chalk",
      productUrl: "http://localhost:3000",
      startedAt: at(60 * 26),
      endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    },
    testers,
    scripts,
    feedback,
    links: [],
    groups: [],
    tickets: [],
    decisions: [],
    nextTicket: 101,
    manager: "Sam (UAT manager)",
  };
}
