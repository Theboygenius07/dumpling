import { promises as fs } from "node:fs";
import path from "node:path";
import type { Store } from "./types";

const FILE = path.join(process.cwd(), "data", "store.json");

// Every write goes through one queue, so two decisions landing together can't
// each read the old file and the second erase the first.
let queue: Promise<unknown> = Promise.resolve();

export async function read(): Promise<Store | null> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Store;
  } catch {
    return null;
  }
}

async function write(s: Store) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(s));
  await fs.rename(tmp, FILE);
}

/** Read, change, write — one at a time. */
export function change<T>(fn: (s: Store) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const s = await read();
    if (!s) throw new Error("No cycle yet — open /api/seed first.");
    const out = await fn(s);
    await write(s);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function replace(s: Store): Promise<void> {
  const run = queue.then(() => write(s));
  queue = run.catch(() => undefined);
  return run;
}

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const now = () => new Date().toISOString();
