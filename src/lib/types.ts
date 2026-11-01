// Heard's whole document model. The AI only ever writes `Analysis`, `Link`
// and drafts; every status change comes from a person's `Decision`.

export type Env = { browser: string; os: string; device: string };

export type Tester = { id: string; name: string; env: Env };

export type Step = { id: string; n: number; action: string; expected: string };

export type Script = { id: string; title: string; area: string; steps: Step[] };

export type Verdict = "worked" | "failed" | "off" | "idea";

export type Kind = "bug" | "idea" | "question" | "praise" | "unclear";

export type Severity = "blocker" | "major" | "minor" | "cosmetic";

/** What the model read in one report. Never a status: a proposal. */
export type Analysis = {
  kind: Kind;
  kindConfidence: number; // 0..1
  kindWhy: string;
  summary: string; // the tester's point, restated plainly
  actual: string;
  expected: string;
  evidence: "strong" | "some" | "thin";
  missing: string[]; // what a developer would still need
  question: string; // a kind follow-up when evidence is thin, else ""
  options: string[]; // one-tap answers for that question
  severity: Severity;
  severityWhy: string;
  facts: string[]; // short, atomic facts — used to show what each witness adds
  by: "model" | "rules";
};

export type Message = {
  id: string;
  at: string;
  from: "heard" | "manager" | "tester";
  text: string;
  question?: boolean; // the tester is asked something
  options?: string[];
  answered?: boolean;
};

export type FeedbackStatus =
  | "new" // waiting for a person
  | "asked" // a question is with the tester
  | "ticketed" // part of a ticket
  | "idea" // in the ideas backlog
  | "answered" // a question or a not-a-bug, answered kindly
  | "thanked"; // praise, passed on

export type Feedback = {
  id: string;
  testerId: string;
  scriptId: string | null;
  stepId: string | null;
  verdict: Verdict;
  text: string;
  at: string;
  source: "tester" | "chalk-report" | "app";
  origin?: { sourceId: string; page?: string | null; rating?: number | null; errors?: string[] };
  sameAs: string | null; // the tester themselves said "same as this one"
  notSame?: string[]; // ...or "mine's different"
  analysis: Analysis | null;
  embedding?: number[];
  status: FeedbackStatus;
  groupId: string | null;
  ticketId: string | null;
  messages: Message[];
};

/** A model-proposed "these two are the same", with its working. */
export type Link = {
  a: string;
  b: string;
  score: number; // combined 0..1
  textScore: number; // embedding cosine, rescaled
  sameStep: boolean;
  testerSaid: boolean; // a tester confirmed it themselves
  verdict: "same" | "related" | "different" | "unsure";
  same: string[]; // reasons they match
  differ: string[]; // reasons they might not
  by: "model" | "rules";
  human?: "same" | "different"; // a manager's call, which always wins
};

/** A group is a proposal until a person creates a ticket or files it. */
export type Group = {
  id: string;
  title: string;
  memberIds: string[];
  status: "open" | "ticketed" | "idea" | "closed";
  createdBy: "heard" | "manager";
  ticketId: string | null;
  draft: (TicketDraft & { credits: Record<string, string>; by: "model" | "rules" }) | null;
};

export type TicketDraft = {
  title: string;
  severity: Severity;
  severityWhy: string;
  steps: string[];
  expected: string;
  actual: string;
  notes: string;
};

export type Ticket = TicketDraft & {
  id: string; // CH-101
  groupId: string;
  witnessIds: string[];
  createdAt: string;
  approvedBy: string;
  draftedBy: "model" | "rules";
  edited: string[]; // which fields the manager changed from the draft
  status: "open" | "in-progress" | "fixed";
};

export type Decision = {
  id: string;
  at: string;
  by: string;
  action:
    | "create-ticket"
    | "split"
    | "join"
    | "file-idea"
    | "set-kind"
    | "ask"
    | "answer"
    | "thank"
    | "reopen";
  target: string; // group or feedback id
  aiSaid: string;
  humanSaid: string;
  overruled: boolean;
};

/** Somewhere feedback comes from besides scripted testing: an app's widget, an API, chalk's own reports. */
export type Source = { id: string; name: string; kind: "widget" | "api" | "chalk"; key: string; createdAt: string; count: number; lastAt: string | null };

/** One cycle of one product's workspace. Heard is product-agnostic: chalk is just the first workspace. */
export type Cycle = { id: string; name: string; product: string; productAbout?: string; ticketPrefix?: string; productUrl: string; startedAt: string; endsAt: string };

export type Store = {
  cycle: Cycle;
  testers: Tester[];
  scripts: Script[];
  feedback: Feedback[];
  links: Link[];
  groups: Group[];
  tickets: Ticket[];
  decisions: Decision[];
  nextTicket: number;
  manager: string;
  sources?: Source[];
};
