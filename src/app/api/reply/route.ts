import { Refused, testerReplies } from "@/lib/decide";
import { access, testerFor } from "@/lib/access";
import { change } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { feedbackId?: string; text?: string } | null;
  if (!b?.feedbackId || !b.text?.trim()) return Response.json({ message: "Say a few words first." }, { status: 400 });
  const a = await access(req, "test");
  if (a instanceof Response) return a;
  try {
    await change(a.ws, (s) => {
      // Only the person who wrote the note answers questions about it.
      const f = s.feedback.find((x) => x.id === b.feedbackId);
      if (!f || testerFor(s, a, req, f.testerId, false) !== f.testerId) throw new Refused("That note isn’t yours to answer.");
      return testerReplies(s, b.feedbackId!, b.text!);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ message: e instanceof Refused ? e.message : "That didn’t send — try again." }, { status: 409 });
  }
}
