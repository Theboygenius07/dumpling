import { clearSessionCookie, endSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await endSession(req);
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie } });
}
