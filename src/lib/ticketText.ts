import type { Store, Ticket } from "./types";

/** A ticket as Markdown — what GitHub gets, and what "Copy" puts on the clipboard. */
export function ticketMarkdown(s: Pick<Store, "feedback" | "testers" | "cycle">, t: Ticket) {
  const w = t.witnessIds.map((id) => s.feedback.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f);
  const who = (id: string) => s.testers.find((x) => x.id === id);
  return [
    `**Severity:** ${t.severity} — ${t.severityWhy}`,
    "",
    "### Steps to reproduce",
    ...t.steps.map((x, i) => `${i + 1}. ${x}`),
    "",
    `**Expected:** ${t.expected}`,
    `**Actual:** ${t.actual}`,
    "",
    `### Seen by ${w.length} ${w.length === 1 ? "tester" : "testers"}`,
    "| Tester | Browser | OS | Device | Their words |",
    "|---|---|---|---|---|",
    ...w.map((f) => {
      const p = who(f.testerId);
      return `| ${p?.name ?? "—"} | ${p?.env.browser ?? "—"} | ${p?.env.os ?? "—"} | ${p?.env.device ?? "—"} | “${f.text.replace(/\|/g, "/").replace(/\n/g, " ")}” |`;
    }),
    "",
    t.notes ? `**Notes:** ${t.notes}` : "",
    "",
    `_From UAT (${s.cycle.name}), ticket ${t.id}. Drafted by Dumpling, approved by ${t.approvedBy}${t.edited.length ? `, who edited: ${t.edited.join(", ")}` : ""}._`,
  ].join("\n");
}

/** Jira's wiki markup, from the same Markdown. */
export function toJira(md: string) {
  return md
    .replace(/^### (.*)$/gm, "h3. $1")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^_(.*)_$/gm, "_$1_")
    .replace(/^\|---.*\|$/gm, "")
    .replace(/^\| Tester \|.*$/gm, "|| Tester || Browser || OS || Device || Their words ||")
    .replace(/^(\d+)\. /gm, "# ");
}
