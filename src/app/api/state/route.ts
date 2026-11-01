import { read } from "@/lib/store";
import { hasModel } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await read();
  if (!s) return Response.json({ empty: true, model: hasModel() });
  // Embeddings stay on the server: they are big and mean nothing to a person.
  return Response.json({ ...s, feedback: s.feedback.map(({ embedding: _e, ...f }) => f), model: hasModel() });
}
