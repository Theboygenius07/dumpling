import { change, findWorkspace, now, uid } from "@/lib/store";
import { envFrom, hash } from "@/lib/sources";
import { ack, triage } from "@/lib/triage";
import type { Feedback, Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Feedback from inside someone's app — the widget, or their server. Keyed, and
// callable from any origin, because the widget runs on the app's own domain.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, authorization" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Body = { key?: string; text?: string; kind?: string; name?: string; email?: string; page?: string; rating?: number; userAgent?: string; errors?: string[] };
const VERDICT: Record<string, Verdict> = { problem: "failed", bug: "failed", idea: "idea", praise: "worked", question: "off" };

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || b?.key || "";
  const text = b?.text?.toString().trim().slice(0, 4000) ?? "";
  if (text.length < 2) return Response.json({ message: "Say what happened, in a few words." }, { status: 400, headers: CORS });
  // The key alone says which workspace this belongs to.
  const ws = key ? await findWorkspace((s) => (s.sources ?? []).some((x) => x.key === key)) : null;
  if (!ws) return Response.json({ message: "That key isn’t connected to Dumpling." }, { status: 401, headers: CORS });
  try {
    const out = await change(ws, async (s) => {
      const src = (s.sources ?? []).find((x) => x.key === key);
      if (!src) return null;
      const ua = b?.userAgent || req.headers.get("user-agent") || "";
      const who = (b?.email || b?.name || "").toString().trim();
      const id = `u_${hash(who || ua || "anon")}`;
      if (!s.testers.some((t) => t.id === id)) {
        s.testers.push({ id, name: (b?.name?.toString().trim() || `${s.cycle.product} user`).slice(0, 60), env: envFrom(ua) });
      }
      const f: Feedback = {
        id: uid("f"), testerId: id, scriptId: null, stepId: null,
        verdict: VERDICT[b?.kind ?? "problem"] ?? "failed",
        text, at: now(), source: "app",
        origin: { sourceId: src.id, page: b?.page?.toString().slice(0, 300) ?? null, rating: typeof b?.rating === "number" ? b.rating : null, errors: Array.isArray(b?.errors) ? b!.errors!.map(String).slice(0, 3).map((e) => e.slice(0, 200)) : [] },
        sameAs: null, analysis: null, status: "new", groupId: null, ticketId: null, messages: [],
      };
      s.feedback.push(f);
      await triage(s, f);
      ack(s, f);
      src.count += 1;
      src.lastAt = f.at;
      return f;
    });
    if (!out) return Response.json({ message: "That key isn’t connected to Dumpling." }, { status: 401, headers: CORS });
    return Response.json({ ok: true, id: out.id, message: "Thanks — a person on the team reads every note." }, { headers: CORS });
  } catch (e) {
    console.error("[dumpling] intake failed:", e);
    return Response.json({ message: "That didn’t send — try again." }, { status: 500, headers: CORS });
  }
}
