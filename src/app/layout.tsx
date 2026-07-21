import type { Metadata } from "next";

import { ViewerProvider } from "../components/auth/ViewerContext";
import { getViewer } from "../lib/auth/viewer";

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

/*
 * Resolving the viewer here reads cookies, which opts the whole tree into
 * dynamic rendering — /experiments, /lab-composer and the guest lab pages were
 * prerendered before this and are now server-rendered per request.
 *
 * That cost was accepted deliberately. A header can only tell the truth about
 * who is signed in if it knows per request; a prerendered shell has to show one
 * nav to everybody, which is what left the "Sign in" link up for signed-in
 * students and teachers and advertised the teacher workspace to guests. The
 * added work is a server render plus one profiles select — src/proxy.ts already
 * calls auth.getUser() on every one of these routes, so none of them reached
 * the browser without a function invocation to begin with.
 *
 * Restoring prerendering means PPR (`cacheComponents`) with this read behind
 * Suspense, not moving the read into the browser: resolving the session client
 * side reintroduces a nav that changes shape after paint.
 */
export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();

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
        <ViewerProvider viewer={viewer}>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </ViewerProvider>
      </body>
    </html>
  );
}
