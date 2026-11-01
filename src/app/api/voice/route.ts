import { promises as fs } from "node:fs";
import path from "node:path";
import { access } from "@/lib/access";
import { db } from "@/lib/docs";
import { SCENES } from "../../voice/script";

export const dynamic = "force-dynamic";

// The voiceover takes, one file per scene, kept on this Mac only.
const DIR = path.join(process.cwd(), "data", "voice");
const ids = new Set(SCENES.map((s) => s.id));
const slug = (id: string) => id.replace(/\s+/g, "_");

// A tool for recording the demo's voiceover on one Mac: off when hosted.
async function gate(req: Request) {
  if (db().kind !== "file") return Response.json({ message: "The voiceover recorder runs only on a local install." }, { status: 404 });
  const a = await access(req, "manage");
  return a instanceof Response ? a : null;
}

export async function GET(req: Request) {
  const g = await gate(req);
  if (g) return g;
  const have = await fs.readdir(DIR).catch(() => [] as string[]);
  return Response.json({ recorded: SCENES.filter((s) => have.some((f) => f.startsWith(`${slug(s.id)}.`))).map((s) => s.id) });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (g) return g;
  const scene = new URL(req.url).searchParams.get("scene") ?? "";
  if (!ids.has(scene)) return Response.json({ message: "Unknown scene." }, { status: 400 });
  const type = req.headers.get("content-type") ?? "";
  const ext = type.includes("mp4") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 2000) return Response.json({ message: "That take was empty — check the microphone." }, { status: 400 });
  await fs.mkdir(DIR, { recursive: true });
  for (const f of await fs.readdir(DIR)) if (f.startsWith(`${slug(scene)}.`)) await fs.unlink(path.join(DIR, f));
  await fs.writeFile(path.join(DIR, `${slug(scene)}.${ext}`), buf);
  return Response.json({ ok: true });
}
