import { access } from "@/lib/access";
import { IntegrationError, integrations, publicIntegrations, pushTicket, type Target } from "@/lib/integrations";
import { change, read } from "@/lib/store";
import { ticketMarkdown } from "@/lib/ticketText";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A double click must not make two issues: one send per ticket and place at a time.
const sending = new Set<string>();

/** Where tickets can go from this workspace — for the people who can send them. */
export async function GET(req: Request) {
  const a = await access(req, "ship");
  if (a instanceof Response) return a;
  const p = await publicIntegrations(a.ws);
  return Response.json({ github: p.github?.repo ?? null, jira: p.jira?.projectKey ?? null, manager: a.role === "manager" });
}

/** Send one ticket to GitHub or Jira. Pushing again returns the issue already made, never a duplicate. */
export async function POST(req: Request) {
  const a = await access(req, "ship");
  if (a instanceof Response) return a;
  const b = (await req.json().catch(() => null)) as { ticketId?: string; target?: Target } | null;
  const target = b?.target;
  if (target !== "github" && target !== "jira") return Response.json({ message: "GitHub or Jira?" }, { status: 400 });
  const s = await read(a.ws);
  const t = s?.tickets.find((x) => x.id === b?.ticketId);
  if (!s || !t) return Response.json({ message: "That ticket isn’t here." }, { status: 404 });
  if (t.pushed?.[target]) return Response.json({ ok: true, ...t.pushed[target], already: true });
  const cfg = (await integrations(a.ws))[target];
  if (!cfg) return Response.json({ message: `${target === "github" ? "GitHub" : "Jira"} isn’t connected — a manager can connect it in Settings › Integrations.` }, { status: 400 });
  const key = `${a.ws}:${t.id}:${target}`;
  if (sending.has(key)) return Response.json({ message: "Already sending — one moment." }, { status: 409 });
  sending.add(key);
  try {
    const out = await pushTicket(target, cfg, t, ticketMarkdown(s, t));
    await change(a.ws, (st) => {
      const tt = st.tickets.find((x) => x.id === t.id);
      if (tt) tt.pushed = { ...tt.pushed, [target]: out };
    });
    return Response.json({ ok: true, ...out });
  } catch (e) {
    return Response.json({ message: e instanceof IntegrationError ? e.message : "That didn’t go through — try again." }, { status: 502 });
  } finally {
    sending.delete(key);
  }
}
