import type { Metadata, Viewport } from "next";
import { AnnouncementBar } from "@/components/announcement/AnnouncementBar";
import { CampusPicker } from "@/components/campus/CampusPicker";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { MenuDrawer } from "@/components/menu/MenuDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { BOOT_SCRIPT } from "@/lib/boot-script";
import { getAnnouncements, getCampuses, getCategories, getTrendingSearches } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // The base of every relative address in metadata, such as the share cards' (info and system spec 2.7).
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Vossie · The Eduvos student marketplace",
    template: "%s · Vossie",
  },
  description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
  applicationName: "Vossie",
  appleWebApp: {
    capable: true,
    title: "Vossie",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15305D",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [announcements, campuses, categories, trending] = await Promise.all([
    getAnnouncements(),
    getCampuses(),
    getCategories(),
    getTrendingSearches(),
  ]);

  return (
    <html lang="en-ZA" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <head>
        {/* Before first paint: data saver and the install prompt (lib/boot-script.ts). */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AnnouncementBar messages={announcements} />
        <SiteHeader campuses={campuses} />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter campuses={campuses} />
        <MenuDrawer campuses={campuses} categories={categories} />
        <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </body>
    </html>
  );
}
