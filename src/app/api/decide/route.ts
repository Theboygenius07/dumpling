import { decide, Refused, type Action } from "@/lib/decide";
import { change } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Action | Action[] | null;
  // One decision per request, by construction: there is no batch form.
  if (!body || Array.isArray(body) || typeof body !== "object") return Response.json({ message: "One decision at a time." }, { status: 400 });
  try {
    const result = await change((s) => decide(s, body));
    return Response.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Refused ? e.message : "That didn’t go through — try again.";
    if (!(e instanceof Refused)) console.error("[dumpling] decide failed:", e);
    return Response.json({ message: msg }, { status: 409 });
  }
}
