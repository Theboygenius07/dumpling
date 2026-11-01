import { promises as fs } from "node:fs";
import path from "node:path";
import { setProduct } from "./ai";
import type { Store } from "./types";

// Each workspace is one JSON file; an index lists them. Which workspace a
// browser is looking at travels in a cookie, so two people can work in two
// workspaces at once.
const DIR = path.join(process.cwd(), "data", "workspaces");
const INDEX = path.join(process.cwd(), "data", "workspaces.json");
const LEGACY = path.join(process.cwd(), "data", "store.json");
export const DEMO_WS = "ws_chalk";
export const WS_COOKIE = "dumpling_ws";

export type WorkspaceRef = { id: string; name: string; createdAt: string };
type Index = { list: WorkspaceRef[] };

// Every write goes through one queue, so two decisions landing together can't
// each read the old file and the second erase the first.
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
};

const fileOf = (ws: string) => {
  if (!/^ws_[a-z0-9_]+$/i.test(ws)) throw new Error("Bad workspace id");
  return path.join(DIR, `${ws}.json`);
};

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);
}

export async function listWorkspaces(): Promise<WorkspaceRef[]> {
  try {
    return (JSON.parse(await fs.readFile(INDEX, "utf8")) as Index).list;
  } catch {
    // The first build kept one store at data/store.json; it becomes the demo workspace.
    try {
      await fs.access(LEGACY);
      await fs.mkdir(DIR, { recursive: true });
      await fs.rename(LEGACY, fileOf(DEMO_WS));
      const list = [{ id: DEMO_WS, name: "chalk", createdAt: new Date().toISOString() }];
      await writeJson(INDEX, { list });
      return list;
    } catch {
      return [];
    }
  }
}

async function saveIndex(list: WorkspaceRef[]) {
  await writeJson(INDEX, { list });
}

/** The workspace a request is about: its cookie if that workspace exists, else the first one. */
export async function wsOf(req: Request): Promise<string | null> {
  const list = await listWorkspaces();
  const cookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${WS_COOKIE}=([^;]+)`))?.[1];
  if (cookie && list.some((w) => w.id === cookie)) return cookie;
  return list[0]?.id ?? null;
}

export async function read(ws: string | null): Promise<Store | null> {
  if (!ws) return null;
  try {
    const s = JSON.parse(await fs.readFile(fileOf(ws), "utf8")) as Store;
    setProduct(s.cycle);
    return s;
  } catch {
    return null;
  }
}

/** Read, change, write — one at a time. */
export function change<T>(ws: string | null, fn: (s: Store) => Promise<T> | T): Promise<T> {
  return serial(async () => {
    const s = await read(ws);
    if (!s || !ws) throw new Error("No workspace yet — create one, or load the demo.");
    const out = await fn(s);
    setProduct(s.cycle);
    await writeJson(fileOf(ws), s);
    return out;
  });
}

/** Write a whole workspace, adding it to the index if it is new. */
export function replace(ws: string, s: Store, name?: string): Promise<void> {
  return serial(async () => {
    await writeJson(fileOf(ws), s);
    const list = await listWorkspaces();
    const label = name ?? s.cycle.product;
    const at = list.find((w) => w.id === ws);
    if (at) at.name = label;
    else list.push({ id: ws, name: label, createdAt: new Date().toISOString() });
    await saveIndex(list);
  });
}

export async function renameWorkspace(ws: string, name: string) {
  const list = await listWorkspaces();
  const at = list.find((w) => w.id === ws);
  if (at && at.name !== name) {
    at.name = name;
    await saveIndex(list);
  }
}

/** Every workspace, for the one place that must look across them: the intake key lookup. */
export async function findWorkspace(pred: (s: Store) => boolean): Promise<string | null> {
  for (const w of await listWorkspaces()) {
    const s = await read(w.id);
    if (s && pred(s)) return w.id;
  }
  return null;
}

export const wsCookie = (ws: string) => `${WS_COOKIE}=${ws}; Path=/; Max-Age=31536000; SameSite=Lax`;

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const now = () => new Date().toISOString();
