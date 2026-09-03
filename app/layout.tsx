import type { Metadata, Viewport } from "next";
import { Unbounded, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const display = Unbounded({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display"
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "UNLOCK — Don't just see the ad. Unlock it.",
  description:
    "The interaction economy — verified actions, not followers. Brands create experiences. People participate. UNLOCK proves what happened.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UNLOCK"
  }
};

export const viewport: Viewport = {
  themeColor: "#0B0A14",
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
