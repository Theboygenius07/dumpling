import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./docs";
import { cookieOf, workspaceRefs } from "./store";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// Accounts, sessions and who may do what in which workspace.
//   users/<id>       the account (password stored as a salted scrypt hash)
//   emails/<email>   email → user id
//   sessions/<hash>  a session; the cookie holds the token, the store only its hash
//   members/<ws>     who is in a workspace, with which role
//   userws/<user>    the workspaces a person belongs to
//   invites/<token>  a pending invitation to a workspace

export type Role = "manager" | "tester" | "developer";
export const ROLES: Role[] = ["manager", "tester", "developer"];
export type User = { id: string; email: string; name: string; salt: string; hash: string; createdAt: string };
export type PublicUser = { id: string; email: string; name: string };
type Session = { userId: string; createdAt: string; expiresAt: string };
export type Member = { userId: string; role: Role };
export type Invite = { token: string; ws: string; email: string; role: Role; createdAt: string };
type Members = { members: Member[] };

export const SESSION_COOKIE = "dumpling_session";
const DAYS = 30;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (e: string) => e.trim().toLowerCase();
export const publicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, name: u.name });

async function hashPassword(pw: string, salt = randomBytes(16)) {
  return { salt: salt.toString("hex"), hash: (await scrypt(pw, salt, 32)).toString("hex") };
}

export class AuthError extends Error {}

/** A guest for the demo: a real account with an unguessable address and password, which simply expires with its session. */
export async function guestUser(): Promise<User> {
  return signUp(`guest-${randomBytes(6).toString("hex")}@demo.dumpling`, "Guest", randomBytes(24).toString("base64url"), { guest: true });
}

export async function signUp(email: string, name: string, password: string, opts: { guest?: boolean } = {}): Promise<User> {
  const e = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AuthError("That doesn’t look like an email address.");
  if (!name.trim()) throw new AuthError("Tell us your name.");
  if (password.length < 8) throw new AuthError("Use at least 8 characters for the password.");
  // Guests never count as the first account.
  const first = !opts.guest && (await db().list<User>("users")).filter((x) => !x.data.email.endsWith("@demo.dumpling")).length === 0;
  const user = await db().tx(async (t) => {
    if (await t.get("emails", e)) throw new AuthError("There’s already an account with that email — sign in instead.");
    const u: User = { id: `u_${randomBytes(6).toString("hex")}`, email: e, name: name.trim().slice(0, 60), ...(await hashPassword(password)), createdAt: new Date().toISOString() };
    await t.put("users", u.id, u);
    await t.put("emails", e, { userId: u.id });
    return u;
  });
  // The very first account looks after every workspace that already exists.
  if (first && !opts.guest) for (const { id } of await workspaceRefs()) await addMember(id, user.id, "manager");
  await acceptInvitesFor(user);
  return user;
}

export async function signIn(email: string, password: string): Promise<User | null> {
  const hit = await db().get<{ userId: string }>("emails", norm(email));
  const u = hit ? await db().get<User>("users", hit.userId) : null;
  // Hash even when there's no such user, so timing doesn't reveal which emails exist.
  const { hash } = await hashPassword(password, Buffer.from(u?.salt ?? "00".repeat(16), "hex"));
  if (!u) return null;
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(u.hash, "hex")) ? u : null;
}

export async function createSession(userId: string, days = DAYS): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const at = new Date();
  await db().put<Session>("sessions", sha(token), { userId, createdAt: at.toISOString(), expiresAt: new Date(at.getTime() + days * 86_400_000).toISOString() });
  return token;
}

export async function endSession(req: Request) {
  const token = cookieOf(req, SESSION_COOKIE);
  if (token) await db().del("sessions", sha(token));
}

export async function userFrom(req: Request): Promise<User | null> {
  const token = cookieOf(req, SESSION_COOKIE);
  if (!token) return null;
  const s = await db().get<Session>("sessions", sha(token));
  if (!s || s.expiresAt < new Date().toISOString()) return null;
  return db().get<User>("users", s.userId);
}

export function sessionCookie(token: string, req: Request, days = DAYS) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${secure}`;
}
export const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// ---------- membership ----------

export async function membersOf(ws: string): Promise<Member[]> {
  return (await db().get<Members>("members", ws))?.members ?? [];
}

export async function roleOf(userId: string, ws: string): Promise<Role | null> {
  return (await membersOf(ws)).find((m) => m.userId === userId)?.role ?? null;
}

export async function workspacesOf(userId: string): Promise<string[]> {
  return (await db().get<{ workspaces: string[] }>("userws", userId))?.workspaces ?? [];
}

export async function addMember(ws: string, userId: string, role: Role) {
  await db().tx(async (t) => {
    const m = (await t.get<Members>("members", ws)) ?? { members: [] };
    const at = m.members.find((x) => x.userId === userId);
    if (at) at.role = role;
    else m.members.push({ userId, role });
    await t.put("members", ws, m);
    const u = (await t.get<{ workspaces: string[] }>("userws", userId)) ?? { workspaces: [] };
    if (!u.workspaces.includes(ws)) u.workspaces.push(ws);
    await t.put("userws", userId, u);
  });
}

export async function removeMember(ws: string, userId: string) {
  await db().tx(async (t) => {
    const m = (await t.get<Members>("members", ws)) ?? { members: [] };
    const left = m.members.filter((x) => x.userId !== userId);
    if (!left.some((x) => x.role === "manager")) throw new AuthError("A workspace needs at least one manager.");
    await t.put("members", ws, { members: left });
    const u = (await t.get<{ workspaces: string[] }>("userws", userId)) ?? { workspaces: [] };
    await t.put("userws", userId, { workspaces: u.workspaces.filter((x) => x !== ws) });
  });
}

/** Invite someone. If they already have an account they join at once; otherwise a link waits for them. */
export async function invite(ws: string, email: string, role: Role): Promise<{ joined: boolean; token?: string }> {
  const e = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AuthError("That doesn’t look like an email address.");
  const hit = await db().get<{ userId: string }>("emails", e);
  if (hit) {
    await addMember(ws, hit.userId, role);
    return { joined: true };
  }
  const token = randomBytes(18).toString("base64url");
  await db().put<Invite>("invites", token, { token, ws, email: e, role, createdAt: new Date().toISOString() });
  return { joined: false, token };
}

export async function invitesOf(ws: string): Promise<Invite[]> {
  return (await db().list<Invite>("invites")).map((x) => x.data).filter((x) => x.ws === ws);
}

export async function revokeInvite(ws: string, token: string) {
  const inv = await db().get<Invite>("invites", token);
  if (inv?.ws === ws) await db().del("invites", token);
}

export async function inviteByToken(token: string): Promise<Invite | null> {
  return token ? db().get<Invite>("invites", token) : null;
}

/** Joining: every pending invitation addressed to this email is accepted. */
export async function acceptInvitesFor(user: User) {
  for (const { id, data } of await db().list<Invite>("invites")) {
    if (data.email === user.email) {
      await addMember(data.ws, user.id, data.role);
      await db().del("invites", id);
    }
  }
}

export async function usersById(ids: string[]): Promise<PublicUser[]> {
  const out: PublicUser[] = [];
  for (const id of ids) {
    const u = await db().get<User>("users", id);
    if (u) out.push(publicUser(u));
  }
  return out;
}
