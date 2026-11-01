import { Refused, testerReplies } from "@/lib/decide";
import { change } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { feedbackId?: string; text?: string } | null;
  if (!b?.feedbackId || !b.text?.trim()) return Response.json({ message: "Say a few words first." }, { status: 400 });
  try {
    await change((s) => testerReplies(s, b.feedbackId!, b.text!));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ message: e instanceof Refused ? e.message : "That didn’t send — try again." }, { status: 409 });
  }
}
