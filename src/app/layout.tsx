import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./Nav";

export const metadata: Metadata = {
  title: "Heard — UAT, untangled",
  description: "Feedback that is easy to give and easy to act on, with a person deciding every step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
