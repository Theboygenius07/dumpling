import { change } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The workspace's product: what Heard tells the model it is testing, and how tickets are numbered. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { product?: string; productAbout?: string; ticketPrefix?: string; productUrl?: string; name?: string } | null;
  const product = b?.product?.trim().slice(0, 40) ?? "";
  if (!product) return Response.json({ message: "Give the product a name." }, { status: 400 });
  const prefix = (b?.ticketPrefix ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
  const c = await change((s) => {
    s.cycle.product = product;
    s.cycle.productAbout = b?.productAbout?.trim().slice(0, 120) ?? "";
    s.cycle.ticketPrefix = prefix || s.cycle.ticketPrefix || "T";
    if (b?.productUrl?.trim()) s.cycle.productUrl = b.productUrl.trim().slice(0, 200);
    if (b?.name?.trim()) s.cycle.name = b.name.trim().slice(0, 60);
    return s.cycle;
  });
  return Response.json({ ok: true, cycle: c });
}
