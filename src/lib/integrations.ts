import { db } from "./docs";
import { open, seal } from "./secrets";
import { toJira } from "./ticketText";
import type { Ticket } from "./types";

// Where tickets can be pushed. Kept apart from the workspace document so its
// tokens never travel with the workspace to a browser.
export type GitHubCfg = { repo: string; token: string };
export type JiraCfg = { baseUrl: string; email: string; token: string; projectKey: string; issueType?: string };
type Stored = { github?: GitHubCfg; jira?: JiraCfg };
export type Target = "github" | "jira";

export class IntegrationError extends Error {}

// GITHUB_API_URL is for GitHub Enterprise or a test server — set on the server, never by a visitor.
const GH_API = () => process.env.GITHUB_API_URL || "https://api.github.com";

export async function integrations(ws: string): Promise<Stored> {
  const s = (await db().get<Stored>("integrations", ws)) ?? {};
  return {
    github: s.github ? { ...s.github, token: await open(s.github.token) } : undefined,
    jira: s.jira ? { ...s.jira, token: await open(s.jira.token) } : undefined,
  };
}

/** What a browser may know: that it's connected, and where to — never the token. */
export async function publicIntegrations(ws: string) {
  const s = (await db().get<Stored>("integrations", ws)) ?? {};
  return {
    github: s.github ? { repo: s.github.repo } : null,
    jira: s.jira ? { baseUrl: s.jira.baseUrl, email: s.jira.email, projectKey: s.jira.projectKey } : null,
  };
}

export async function saveIntegration(ws: string, target: Target, cfg: GitHubCfg | JiraCfg) {
  // Encrypt before taking the lock: sealing may read the key from the store,
  // and a second call from inside a transaction waits on itself.
  const token = await seal(cfg.token);
  await db().tx(async (t) => {
    const s = (await t.get<Stored>("integrations", ws)) ?? {};
    if (target === "github") s.github = { ...(cfg as GitHubCfg), token };
    else s.jira = { ...(cfg as JiraCfg), token };
    await t.put("integrations", ws, s);
  });
}

export async function removeIntegration(ws: string, target: Target) {
  await db().tx(async (t) => {
    const s = (await t.get<Stored>("integrations", ws)) ?? {};
    delete s[target];
    await t.put("integrations", ws, s);
  });
}

async function call(url: string, init: RequestInit, what: string) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r) throw new IntegrationError(`Couldn’t reach ${what}.`);
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new IntegrationError(`${what} refused the token — check it has access.`);
  if (r.status === 404) throw new IntegrationError(`${what} couldn’t find that ${what === "GitHub" ? "repository" : "project"}.`);
  if (!r.ok) throw new IntegrationError(`${what} said: ${(body as { message?: string; errorMessages?: string[] }).message ?? (body as { errorMessages?: string[] }).errorMessages?.[0] ?? r.status}`);
  return body as Record<string, unknown>;
}

const gh = (cfg: GitHubCfg) => ({ authorization: `Bearer ${cfg.token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "dumpling-uat", "content-type": "application/json" });
const jira = (cfg: JiraCfg) => ({ authorization: `Basic ${Buffer.from(`${cfg.email}:${cfg.token}`).toString("base64")}`, accept: "application/json", "content-type": "application/json" });
const base = (u: string) => u.replace(/\/+$/, "");

/** Check the settings work before saving them. */
export async function testIntegration(target: Target, cfg: GitHubCfg | JiraCfg): Promise<string> {
  if (target === "github") {
    const c = cfg as GitHubCfg;
    if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) throw new IntegrationError("Use the form owner/repository.");
    const r = await call(`${base(GH_API())}/repos/${c.repo}`, { headers: gh(c) }, "GitHub");
    if (r.has_issues === false) throw new IntegrationError("That repository has issues turned off.");
    return `Connected to ${r.full_name ?? c.repo}.`;
  }
  const c = cfg as JiraCfg;
  const me = await call(`${base(c.baseUrl)}/rest/api/2/myself`, { headers: jira(c) }, "Jira");
  await call(`${base(c.baseUrl)}/rest/api/2/project/${encodeURIComponent(c.projectKey)}`, { headers: jira(c) }, "Jira");
  return `Connected as ${me.displayName ?? c.email} to ${c.projectKey}.`;
}

/** Create the issue; returns where it lives. */
export async function pushTicket(target: Target, cfg: GitHubCfg | JiraCfg, t: Ticket, md: string): Promise<{ url: string; ref: string }> {
  const labels = ["uat", `severity-${t.severity}`];
  if (target === "github") {
    const c = cfg as GitHubCfg;
    const r = await call(`${base(GH_API())}/repos/${c.repo}/issues`, { method: "POST", headers: gh(c), body: JSON.stringify({ title: `${t.id}: ${t.title}`, body: md, labels }) }, "GitHub");
    return { url: String(r.html_url), ref: `#${r.number}` };
  }
  const c = cfg as JiraCfg;
  const r = await call(`${base(c.baseUrl)}/rest/api/2/issue`, {
    method: "POST",
    headers: jira(c),
    body: JSON.stringify({ fields: { project: { key: c.projectKey }, summary: `${t.id}: ${t.title}`.slice(0, 250), description: toJira(md), issuetype: { name: c.issueType || "Bug" }, labels } }),
  }, "Jira");
  return { url: `${base(c.baseUrl)}/browse/${r.key}`, ref: String(r.key) };
}
