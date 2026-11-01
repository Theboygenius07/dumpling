import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "./Shell";
import { StoreProvider } from "./ui";

export const metadata: Metadata = {
  title: "Dumpling — UAT feedback, neatly folded",
  description: "Clear feedback from every tester, with a person deciding every step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
