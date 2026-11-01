import { listWorkspaces, read, wsOf } from "@/lib/store";
import { hasModel } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ws = await wsOf(req);
  const workspaces = await listWorkspaces();
  const s = await read(ws);
  if (!s) return Response.json({ empty: true, model: hasModel(), workspaces });
  // Embeddings stay on the server: they are big and mean nothing to a person.
  return Response.json({ ...s, feedback: s.feedback.map(({ embedding: _e, ...f }) => f), model: hasModel(), workspace: ws, workspaces });
}
