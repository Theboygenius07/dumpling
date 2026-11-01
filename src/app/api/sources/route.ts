import { change, uid, wsOf } from "@/lib/store";
import { ensureSources, newKey } from "@/lib/sources";

export const dynamic = "force-dynamic";

type Body = { action?: "create" | "rotate" | "remove"; id?: string; name?: string; kind?: "widget" | "api" };

/** This workspace's app connections. Rotating a key cuts off the old one at once. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  try {
    const out = await change(await wsOf(req), (s) => {
      const list = ensureSources(s);
      if (b?.action === "create") {
        const name = b.name?.trim().slice(0, 60);
        if (!name) throw new Error("Name the connection — usually the app it lives in.");
        const src = { id: uid("src"), name, kind: b.kind === "api" ? ("api" as const) : ("widget" as const), key: newKey(), createdAt: new Date().toISOString(), count: 0, lastAt: null };
        list.push(src);
        return src;
      }
      const src = list.find((x) => x.id === b?.id);
      if (!src) throw new Error("That connection isn’t here any more.");
      if (src.kind === "chalk") throw new Error("This connector reads chalk’s own log — it has no key.");
      if (b?.action === "rotate") { src.key = newKey(); return src; }
      if (b?.action === "remove") { s.sources = list.filter((x) => x.id !== src.id); return { id: src.id }; }
      throw new Error("Nothing to do.");
    });
    return Response.json({ ok: true, out });
  } catch (e) {
    return Response.json({ message: (e as Error).message }, { status: 400 });
  }
}
