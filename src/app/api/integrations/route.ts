import { access } from "@/lib/access";
import { IntegrationError, publicIntegrations, removeIntegration, saveIntegration, testIntegration, type GitHubCfg, type JiraCfg, type Target } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await access(req, "manage");
  if (a instanceof Response) return a;
  return Response.json(await publicIntegrations(a.ws));
}

type Body = { action?: "test" | "save" | "remove"; target?: Target; repo?: string; baseUrl?: string; email?: string; token?: string; projectKey?: string; issueType?: string };

/** Connect, test or disconnect GitHub or Jira. A connection is tested before it's saved. */
export async function POST(req: Request) {
  const a = await access(req, "manage");
  if (a instanceof Response) return a;
  const b = (await req.json().catch(() => null)) as Body | null;
  const target = b?.target;
  if (target !== "github" && target !== "jira") return Response.json({ message: "GitHub or Jira?" }, { status: 400 });
  try {
    if (b?.action === "remove") { await removeIntegration(a.ws, target); return Response.json({ ok: true }); }
    const token = b?.token?.trim() ?? "";
    if (!token) throw new IntegrationError("Paste a token.");
    const cfg: GitHubCfg | JiraCfg = target === "github"
      ? { repo: b?.repo?.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "") ?? "", token }
      : { baseUrl: b?.baseUrl?.trim() ?? "", email: b?.email?.trim() ?? "", token, projectKey: (b?.projectKey ?? "").trim().toUpperCase(), issueType: b?.issueType?.trim() || undefined };
    if (target === "jira" && !/^https:\/\//.test((cfg as JiraCfg).baseUrl) && !process.env.DUMPLING_ALLOW_HTTP) throw new IntegrationError("Use your Jira site’s https:// address.");
    const message = await testIntegration(target, cfg);
    if (b?.action === "save") await saveIntegration(a.ws, target, cfg);
    return Response.json({ ok: true, message });
  } catch (e) {
    return Response.json({ message: e instanceof IntegrationError ? e.message : "That didn’t work — check the details." }, { status: 400 });
  }
}
