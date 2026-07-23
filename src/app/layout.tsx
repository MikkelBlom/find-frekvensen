import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Find Frekvensen",
  description:
    "Interaktiv radio-station til Ada Lovelace Dag — jag skjulte signaler og saml den hemmelige besked.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#efe7d6",
};

// System font stack only — no next/font/google, so the app builds and runs
// fully offline (important: no internet on the day).
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
