import type { Source, Store, Tester } from "./types";

// A prototype runs on one Mac, so the demo key is fixed: a reset must not
// break a widget already pasted into chalk. A hosted Dumpling issues one per source.
export const DEMO_KEY = process.env.DUMPLING_KEY || "dmp_chalk_demo_4f9a2c";

export function ensureSources(s: Store) {
  if (s.sources?.length) return s.sources;
  const at = new Date().toISOString();
  s.sources = [
    { id: "src_web", name: `${s.cycle.product} web app`, kind: "widget", key: DEMO_KEY, createdAt: at, count: 0, lastAt: null },
    // chalk's own Report a problem log: a connector only the chalk workspace has.
    ...(s.cycle.product.toLowerCase() === "chalk" ? [{ id: "src_chalk_reports", name: "chalk · Report a problem", kind: "chalk" as const, key: "", createdAt: at, count: s.feedback.filter((f) => f.source === "chalk-report").length, lastAt: null }] : []),
  ];
  return s.sources;
}

/** Just enough of the user agent to say what someone was on, the way a tester's profile does. */
export function envFrom(ua: string): Tester["env"] {
  const v = (re: RegExp) => ua.match(re)?.[1]?.split(".")[0];
  const browser = /Edg\//.test(ua) ? `Edge ${v(/Edg\/([\d.]+)/) ?? ""}` : /Firefox\//.test(ua) ? `Firefox ${v(/Firefox\/([\d.]+)/) ?? ""}` : /Chrome\//.test(ua) ? `Chrome ${v(/Chrome\/([\d.]+)/) ?? ""}` : /Safari\//.test(ua) ? `Safari ${v(/Version\/([\d.]+)/) ?? ""}` : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "—";
  const device = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android phone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "PC" : "—";
  return { browser: browser.trim(), os, device };
}

export function hash(x: string) {
  let h = 5381;
  for (const c of x) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

export type { Source };
