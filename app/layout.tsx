import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vossie · The Eduvos student marketplace",
    template: "%s · Vossie",
  },
  description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
  applicationName: "Vossie",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15305D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
