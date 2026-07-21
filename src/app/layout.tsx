import type { Metadata } from "next";

import "./globals.css";

const adobeFontsStylesheet = process.env.NEXT_PUBLIC_ADOBE_FONTS_STYLESHEET;

const hasAdobeFontsStylesheet =
  adobeFontsStylesheet?.startsWith("https://use.typekit.net/") &&
  adobeFontsStylesheet.endsWith(".css");

export const metadata: Metadata = {
  applicationName: "Litmus",
  title: {
    default: "Litmus",
    template: "%s | Litmus"
  },
  description:
    "Practise chemistry techniques in deterministic virtual labs, then review evidence-backed readiness.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {hasAdobeFontsStylesheet ? (
          <>
            <link rel="preconnect" href="https://use.typekit.net" />
            <link rel="stylesheet" href={adobeFontsStylesheet} />
          </>
        ) : null}
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
