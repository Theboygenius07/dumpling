import { change, uid, wsOf } from "@/lib/store";

export const dynamic = "force-dynamic";

type Body = { action?: "add" | "remove"; id?: string; name?: string; browser?: string; os?: string; device?: string };

/** The testers in this workspace. Anyone who has sent a note stays, so the record stays honest. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  try {
    const out = await change(await wsOf(req), (s) => {
      if (b?.action === "add") {
        const name = b.name?.trim().slice(0, 60);
        if (!name) throw new Error("Give them a name.");
        const t = { id: uid("t"), name, env: { browser: b.browser?.trim().slice(0, 40) || "—", os: b.os?.trim().slice(0, 40) || "—", device: b.device?.trim().slice(0, 40) || "—" } };
        s.testers.push(t);
        return t;
      }
      if (b?.action === "remove") {
        if (s.feedback.some((f) => f.testerId === b.id)) throw new Error("They’ve sent notes in this cycle, so they stay on the record.");
        s.testers = s.testers.filter((t) => t.id !== b.id);
        return { id: b.id };
      }
      throw new Error("Nothing to do.");
    });
    return Response.json({ ok: true, out });
  } catch (e) {
    return Response.json({ message: (e as Error).message }, { status: 400 });
  }
}
