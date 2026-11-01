import { access, testerFor } from "@/lib/access";
import { change } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Make sure the signed-in person has a tester record here, with their setup read from this browser. */
export async function POST(req: Request) {
  const a = await access(req, "test");
  if (a instanceof Response) return a;
  const id = await change(a.ws, (s) => testerFor(s, a, req, null, true));
  return Response.json({ ok: true, id });
}
