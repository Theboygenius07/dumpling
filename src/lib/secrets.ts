import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "./docs";

// Integration tokens are encrypted at rest (AES-256-GCM). The key comes from
// DUMPLING_SECRET; a local install without one generates its own and keeps it
// beside the data — set DUMPLING_SECRET when hosting.
// One promise per process, so two first-time calls can't each make a different key.
let key: Promise<Buffer> | null = null;
function keyOf(): Promise<Buffer> {
  key ??= (async () => {
    let secret = process.env.DUMPLING_SECRET;
    if (!secret) {
      const saved = await db().get<{ secret: string }>("config", "secret");
      secret = saved?.secret ?? randomBytes(32).toString("hex");
      if (!saved) await db().put("config", "secret", { secret });
    }
    return createHash("sha256").update(secret).digest();
  })();
  key.catch(() => { key = null; });
  return key;
}

export async function seal(plain: string): Promise<string> {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", await keyOf(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export async function open(sealed: string): Promise<string> {
  const [iv, tag, body] = sealed.split(".").map((x) => Buffer.from(x, "base64url"));
  const d = createDecipheriv("aes-256-gcm", await keyOf(), iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(body!), d.final()]).toString("utf8");
}
