import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Connecting Coders — Find your connection",
  description:
    "Explore the public GitHub follow graph and discover possible paths between developers.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
