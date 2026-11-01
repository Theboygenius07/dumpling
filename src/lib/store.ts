import { promises as fs } from "node:fs";
import path from "node:path";
import { setProduct } from "./ai";
import { db, type Tx } from "./docs";
import type { Store } from "./types";

// A workspace is one document. Two small indexes sit beside it so nothing has
// to load every workspace to answer a simple question:
//   wsmeta/<id>  → its name and when it began (the switcher's list)
//   keys/<key>   → which workspace an app connection's key belongs to
export const DEMO_WS = "ws_chalk";
export const WS_COOKIE = "dumpling_ws";

export type WorkspaceRef = { id: string; name: string; createdAt: string };
type Meta = { name: string; createdAt: string };

const keysOf = (s: Store | null) => new Set((s?.sources ?? []).map((x) => x.key).filter(Boolean));

/** Keep the indexes true to the workspace document, in the same transaction. */
async function syncIndexes(t: Tx, ws: string, before: Store | null, after: Store) {
  const meta = await t.get<Meta>("wsmeta", ws);
  if (!meta || meta.name !== after.cycle.product) {
    await t.put<Meta>("wsmeta", ws, { name: after.cycle.product, createdAt: meta?.createdAt ?? after.cycle.startedAt ?? new Date().toISOString() });
  }
  const was = keysOf(before), now = keysOf(after);
  for (const k of was) if (!now.has(k)) await t.del("keys", k);
  for (const k of now) if (!was.has(k)) await t.put("keys", k, { ws });
}

let migrated = false;
/** One-time moves from earlier layouts: a single data/store.json, then an index file. */
async function migrate() {
  if (migrated || db().kind !== "file") return;
  migrated = true;
  const dir = path.join(process.cwd(), "data");
  try {
    const legacy = JSON.parse(await fs.readFile(path.join(dir, "store.json"), "utf8")) as Store;
    if (!(await db().get("workspaces", DEMO_WS))) await replace(DEMO_WS, legacy);
    await fs.rename(path.join(dir, "store.json"), path.join(dir, "store.json.migrated"));
  } catch {}
}

/** The workspace list is an index; if it's ever missing, rebuild it from the workspaces themselves. */
async function metas(): Promise<{ id: string; data: Meta }[]> {
  let list = await db().list<Meta>("wsmeta");
  if (list.length === 0) {
    for (const { id, data } of await db().list<Store>("workspaces")) await db().tx((t) => syncIndexes(t, id, null, data));
    list = await db().list<Meta>("wsmeta");
  }
  return list;
}

export async function workspaceRefs(ids?: string[]): Promise<WorkspaceRef[]> {
  await migrate();
  const all = (await metas()).map(({ id, data }) => ({ id, ...data }));
  const list = ids ? all.filter((w) => ids.includes(w.id)) : all;
  return list.sort((a, b) => (a.id === DEMO_WS ? 1 : b.id === DEMO_WS ? -1 : a.createdAt.localeCompare(b.createdAt)));
}

export async function read(ws: string | null): Promise<Store | null> {
  if (!ws) return null;
  await migrate();
  const s = await db().get<Store>("workspaces", ws);
  if (s) setProduct(s.cycle);
  return s;
}

/** Read, change, write — under a lock, so two decisions can never overwrite each other. */
export function change<T>(ws: string | null, fn: (s: Store) => Promise<T> | T): Promise<T> {
  return db().tx(async (t) => {
    const s = ws ? await t.get<Store>("workspaces", ws) : null;
    if (!s || !ws) throw new Error("No workspace yet — create one, or open the demo.");
    const before = JSON.parse(JSON.stringify({ sources: s.sources ?? [], cycle: s.cycle })) as Store;
    setProduct(s.cycle);
    const out = await fn(s);
    setProduct(s.cycle);
    await t.put("workspaces", ws, s);
    await syncIndexes(t, ws, before, s);
    return out;
  });
}

/** Write a whole workspace (new, or reset). */
export function replace(ws: string, s: Store): Promise<void> {
  return db().tx(async (t) => {
    const before = await t.get<Store>("workspaces", ws);
    await t.put("workspaces", ws, s);
    await syncIndexes(t, ws, before, s);
  });
}

/** Which workspace an app connection's key belongs to. */
export async function workspaceByKey(key: string): Promise<string | null> {
  if (!key) return null;
  await migrate();
  const hit = await db().get<{ ws: string }>("keys", key);
  if (hit) return hit.ws;
  // Keys written before the index existed: find once, then remember.
  for (const { id, data } of await db().list<Store>("workspaces")) {
    if (keysOf(data).has(key)) {
      await db().put("keys", key, { ws: id });
      return id;
    }
  }
  return null;
}

export const wsCookie = (ws: string) => `${WS_COOKIE}=${ws}; Path=/; Max-Age=31536000; SameSite=Lax`;
export const cookieOf = (req: Request, name: string) => req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? null;

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const now = () => new Date().toISOString();
