"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/test", label: "Test", who: "Tester" },
  { href: "/review", label: "Review", who: "UAT manager" },
  { href: "/tickets", label: "Tickets", who: "Developer" },
  { href: "/ideas", label: "Ideas", who: "Product" },
  { href: "/", label: "Cycle", who: "Everyone" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span className="mark" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 12c3-6 13-6 16 0M7 15c2-3 8-3 10 0M10.5 18c.8-1 2.2-1 3 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </span>
        Heard
      </Link>
      <nav>
        {ITEMS.map((i) => {
          const on = i.href === "/" ? path === "/" : path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} className={on ? "on" : ""}>
              <span>{i.label}</span>
              <small>{i.who}</small>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
