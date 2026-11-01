import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Every piece of Dumpling's state is a JSON document in a collection:
// workspaces, users, sessions, memberships, connection keys. Two backends
// implement the same five calls:
//   - files under data/<collection>/ (the default, and how it runs on one Mac)
//   - Postgres, when DATABASE_URL is set (Supabase, Neon or any hosted Postgres)
// All writes happen inside tx(), which serialises them: one queue for files,
// row locks (SELECT … FOR UPDATE) for Postgres.

export interface Tx {
  get<T>(col: string, id: string): Promise<T | null>;
  put<T>(col: string, id: string, data: T): Promise<void>;
  del(col: string, id: string): Promise<void>;
  list<T>(col: string): Promise<{ id: string; data: T }[]>;
}

export interface Docs extends Tx {
  tx<R>(fn: (t: Tx) => Promise<R>): Promise<R>;
  kind: "file" | "postgres";
}

// ---------- files ----------

// On Vercel the project directory is read-only. Without a database, fall back to
// the function's temporary disk so a demo still works — it does not survive a
// restart, which is why a hosted install should set DATABASE_URL.
const ROOT = process.env.VERCEL ? path.join(os.tmpdir(), "dumpling-data") : path.join(process.cwd(), "data");
const safe = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error(`Bad collection: ${s}`);
  return s;
};
const fileId = (id: string) => encodeURIComponent(id).replace(/%/g, "~").replace(/\./g, "~2E");
const unFileId = (f: string) => decodeURIComponent(f.replace(/~2E/g, ".").replace(/~/g, "%"));

function fileDocs(): Docs {
  let queue: Promise<unknown> = Promise.resolve();
  const file = (col: string, id: string) => path.join(ROOT, safe(col), `${fileId(id)}.json`);
  const ops: Tx = {
    async get<T>(col: string, id: string) {
      try { return JSON.parse(await fs.readFile(file(col, id), "utf8")) as T; } catch { return null; }
    },
    async put<T>(col: string, id: string, data: T) {
      const f = file(col, id);
      await fs.mkdir(path.dirname(f), { recursive: true });
      const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data));
      await fs.rename(tmp, f);
    },
    async del(col: string, id: string) {
      await fs.unlink(file(col, id)).catch(() => {});
    },
    async list<T>(col: string) {
      const dir = path.join(ROOT, safe(col));
      const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json"));
      const out: { id: string; data: T }[] = [];
      for (const n of names) {
        const id = unFileId(n.slice(0, -5));
        const data = await ops.get<T>(col, id);
        if (data) out.push({ id, data });
      }
      return out;
    },
  };
  return {
    ...ops,
    kind: "file",
    tx<R>(fn: (t: Tx) => Promise<R>) {
      const run = queue.then(() => fn(ops));
      queue = run.catch(() => undefined);
      return run;
    },
  };
}

// ---------- Postgres ----------

type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
type Conn = { run<R>(fn: (q: Q) => Promise<R>, transaction: boolean): Promise<R> };

const SCHEMA = `CREATE TABLE IF NOT EXISTS docs (
  col text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (col, id)
)`;

function sqlOps(q: Q, lock: boolean): Tx {
  return {
    async get<T>(col: string, id: string) {
      const r = await q(`SELECT data FROM docs WHERE col = $1 AND id = $2${lock ? " FOR UPDATE" : ""}`, [col, id]);
      return (r.rows[0]?.data as T) ?? null;
    },
    async put<T>(col: string, id: string, data: T) {
      await q(
        `INSERT INTO docs (col, id, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [col, id, JSON.stringify(data)],
      );
    },
    async del(col: string, id: string) {
      await q(`DELETE FROM docs WHERE col = $1 AND id = $2`, [col, id]);
    },
    async list<T>(col: string) {
      const r = await q(`SELECT id, data FROM docs WHERE col = $1 ORDER BY id`, [col]);
      return r.rows.map((x) => ({ id: String(x.id), data: x.data as T }));
    },
  };
}

function postgresDocs(conn: Promise<Conn>): Docs {
  let ready: Promise<void> | null = null;
  const init = () => (ready ??= conn.then((c) => c.run((q) => q(SCHEMA).then(() => undefined), false)));
  const plain = <R>(fn: (t: Tx) => Promise<R>) => init().then(() => conn).then((c) => c.run((q) => fn(sqlOps(q, false)), false));
  return {
    kind: "postgres",
    get: (col, id) => plain((t) => t.get(col, id)),
    put: (col, id, data) => plain((t) => t.put(col, id, data)),
    del: (col, id) => plain((t) => t.del(col, id)),
    list: (col) => plain((t) => t.list(col)),
    tx: (fn) => init().then(() => conn).then((c) => c.run((q) => fn(sqlOps(q, true)), true)),
  };
}

async function pgConn(url: string): Promise<Conn> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  return {
    async run(fn, transaction) {
      const c = await pool.connect();
      const q: Q = (sql, params) => c.query(sql, params as unknown[]);
      try {
        if (!transaction) return await fn(q);
        await c.query("BEGIN");
        try {
          const out = await fn(q);
          await c.query("COMMIT");
          return out;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        }
      } finally {
        c.release();
      }
    },
  };
}

/** An embedded, in-memory Postgres — used to test the Postgres backend without a server. */
async function pgliteConn(): Promise<Conn> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  let chain: Promise<unknown> = Promise.resolve();
  return {
    run(fn, transaction) {
      // PGlite is one connection: serialise, as a pool of one would.
      const go = () => (transaction ? db.transaction((tx) => fn((sql, p) => tx.query(sql, p) as never)) : fn((sql, p) => db.query(sql, p) as never));
      const r = chain.then(go);
      chain = r.catch(() => undefined);
      return r as never;
    },
  };
}

let docs: Docs | null = null;
export function db(): Docs {
  if (docs) return docs;
  // DATABASE_URL, or POSTGRES_URL as Vercel's Postgres (Neon) integration names it.
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) docs = postgresDocs(pgConn(url));
  else if (process.env.DUMPLING_DB === "pglite") docs = postgresDocs(pgliteConn());
  else {
    if (process.env.VERCEL) console.warn("[dumpling] No DATABASE_URL: using temporary storage. Data will not persist.");
    docs = fileDocs();
  }
  return docs;
}
