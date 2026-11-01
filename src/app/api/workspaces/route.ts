import { addMember, userFrom, workspacesOf } from "@/lib/auth";
import { replace, uid, workspaceRefs, wsCookie } from "@/lib/store";
import { ensureSources } from "@/lib/sources";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ message: "Sign in first." }, { status: 401 });
  return Response.json({ list: await workspaceRefs(await workspacesOf(user.id)) });
}

type Body = { select?: string; product?: string; productAbout?: string; ticketPrefix?: string; productUrl?: string; name?: string; manager?: string };

/** Switch this browser to a workspace, or create a new one and switch to it. */
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ message: "Sign in first." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b) return Response.json({ message: "Nothing to do." }, { status: 400 });

  if (b.select) {
    if (!(await workspacesOf(user.id)).includes(b.select)) return Response.json({ message: "You’re not a member of that workspace." }, { status: 403 });
    return Response.json({ ok: true, id: b.select }, { headers: { "set-cookie": wsCookie(b.select) } });
  }

  const product = b.product?.trim().slice(0, 40) ?? "";
  if (!product) return Response.json({ message: "Give the product a name." }, { status: 400 });
  const prefix = (b.ticketPrefix || product).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "T";
  const id = `ws_${product.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "app"}_${uid("x").slice(2, 7)}`;
  const at = new Date();
  const s: Store = {
    cycle: {
      id: uid("cy"),
      name: b.name?.trim().slice(0, 60) || `${product} · UAT cycle 1`,
      product,
      productAbout: b.productAbout?.trim().slice(0, 120) ?? "",
      ticketPrefix: prefix,
      productUrl: b.productUrl?.trim().slice(0, 200) || "",
      startedAt: at.toISOString(),
      endsAt: new Date(at.getTime() + 14 * 86_400_000).toISOString(),
    },
    testers: [],
    scripts: [],
    feedback: [],
    links: [],
    groups: [],
    tickets: [],
    decisions: [],
    nextTicket: 1,
    manager: `${b.manager?.trim().slice(0, 40) || user.name} (UAT manager)`,
  };
  ensureSources(s);
  await replace(id, s);
  // Whoever makes a workspace manages it.
  await addMember(id, user.id, "manager");
  return Response.json({ ok: true, id }, { headers: { "set-cookie": wsCookie(id) } });
}
