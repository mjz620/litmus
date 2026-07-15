import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LabBench AI",
  description: "Practice chemistry experiments with evidence-based guidance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
