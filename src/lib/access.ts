import { publicUser, roleOf, userFrom, workspacesOf, type PublicUser, type Role, type User } from "./auth";
import { envFrom } from "./sources";
import { DEMO_WS, WS_COOKIE, cookieOf, uid } from "./store";
import type { Store } from "./types";

// Every route asks one question before it does anything: who is this, in which
// workspace, and may their role do this? The answer is decided here, on the
// server — the interface only hides what a role can't use.

export type Perm = "view" | "test" | "manage" | "ship";
const ALLOW: Record<Perm, Role[]> = {
  view: ["manager", "tester", "developer"],
  test: ["manager", "tester"],
  manage: ["manager"],
  ship: ["manager", "developer"],
};

export type Access = { user: User; ws: string; role: Role };

const deny = (status: number, message: string, extra: object = {}) => Response.json({ message, ...extra }, { status });

/** The signed-in person, their workspace (cookie if they belong to it, else their first) and role. */
export async function access(req: Request, perm: Perm): Promise<Access | Response> {
  const user = await userFrom(req);
  if (!user) return deny(401, "Sign in first.", { signin: true });
  const mine = await workspacesOf(user.id);
  const wanted = cookieOf(req, WS_COOKIE);
  const ws = wanted && mine.includes(wanted) ? wanted : mine[0];
  if (!ws) return deny(404, "No workspace yet — create one, or open the demo.", { noWorkspace: true, me: publicUser(user) });
  const role = await roleOf(user.id, ws);
  if (!role) return deny(403, "You’re not a member of this workspace.");
  if (!ALLOW[perm].includes(role)) return deny(403, `A ${role} can’t do that in this workspace.`);
  return { user, ws, role };
}

/** Sample testers (no account) exist only in the demo; a manager there may act as one to show the flow. */
export const isSample = (s: Store, id: string) => s.cycle && s.testers.some((t) => t.id === id && !t.userId);

/**
 * Who a note is from. Never what the browser says, except a manager acting as a
 * sample tester in the demo. Anyone else tests as themselves: their tester
 * record is made the first time they test, with their setup read from the browser.
 */
export function testerFor(s: Store, a: Access, req: Request, asked?: string | null, create = true): string | null {
  if (a.ws === DEMO_WS && a.role === "manager" && asked && isSample(s, asked)) return asked;
  const own = s.testers.find((t) => t.userId === a.user.id);
  if (own) return own.id;
  if (!create) return null;
  const t = { id: uid("t"), name: a.user.name, env: envFrom(req.headers.get("user-agent") ?? ""), userId: a.user.id };
  s.testers.push(t);
  return t.id;
}

/** What each role is shown. Secrets never leave the server; testers see their own notes. */
export function viewFor(s: Store, a: Access): Store & { me: PublicUser & { role: Role; testerId: string | null }; demo: boolean } {
  const me = { ...publicUser(a.user), role: a.role, testerId: s.testers.find((t) => t.userId === a.user.id)?.id ?? null };
  const demo = a.ws === DEMO_WS;
  const base = { ...s, feedback: s.feedback.map(({ embedding: _e, ...f }) => f), me, demo };
  if (a.role === "manager") return base;
  const sources: Store["sources"] = [];
  if (a.role === "developer") {
    const shown = new Set(s.tickets.flatMap((t) => t.witnessIds));
    return { ...base, feedback: base.feedback.filter((f) => shown.has(f.id)), links: [], decisions: [], sources };
  }
  // A tester: their own notes, and only the size of the groups those notes are in.
  const mineIds = new Set(s.feedback.filter((f) => f.testerId === me.testerId).map((f) => f.id));
  const groups = s.groups.filter((g) => g.memberIds.some((id) => mineIds.has(id))).map((g) => ({ ...g, memberIds: g.memberIds.map((id) => (mineIds.has(id) ? id : "other")), draft: null }));
  return {
    ...base,
    testers: s.testers.filter((t) => t.id === me.testerId),
    feedback: base.feedback.filter((f) => mineIds.has(f.id)),
    groups,
    links: [],
    tickets: s.tickets.filter((t) => t.witnessIds.some((id) => mineIds.has(id))),
    decisions: [],
    sources,
  };
}
