import { change, uid, wsOf } from "@/lib/store";
import type { Script } from "@/lib/types";

export const dynamic = "force-dynamic";

type In = { id?: string; title?: string; area?: string; steps?: { id?: string; action?: string; expected?: string }[] };

/** Replace this workspace's test scripts. A step a tester has already reported on can't be deleted. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { scripts?: In[] } | null;
  if (!Array.isArray(b?.scripts)) return Response.json({ message: "Send the scripts." }, { status: 400 });
  try {
    const scripts = await change(await wsOf(req), (s) => {
      const next: Script[] = b.scripts!.map((x) => {
        const title = x.title?.trim().slice(0, 80);
        if (!title) throw new Error("Every script needs a title.");
        const steps = (x.steps ?? [])
          .filter((st) => st.action?.trim())
          .map((st, i) => ({ id: st.id || uid("st"), n: i + 1, action: st.action!.trim().slice(0, 240), expected: st.expected?.trim().slice(0, 240) || "It works as described." }));
        if (!steps.length) throw new Error(`“${title}” needs at least one step.`);
        return { id: x.id || uid("s"), title, area: x.area?.trim().slice(0, 40) || "General", steps };
      });
      const kept = new Set(next.flatMap((x) => x.steps.map((st) => st.id)));
      const lost = s.feedback.find((f) => f.stepId && !kept.has(f.stepId));
      if (lost) throw new Error("A step testers have reported on can’t be deleted — edit its words instead.");
      s.scripts = next;
      return next;
    });
    return Response.json({ ok: true, scripts });
  } catch (e) {
    return Response.json({ message: (e as Error).message }, { status: 400 });
  }
}
