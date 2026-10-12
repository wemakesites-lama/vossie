import type { Metadata, Viewport } from "next";
import { AnnouncementBar } from "@/components/announcement/AnnouncementBar";
import { SiteHeader } from "@/components/header/SiteHeader";
import { CampusPicker } from "@/components/campus/CampusPicker";
import { MenuDrawer } from "@/components/menu/MenuDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { getAnnouncements, getCampuses, getCategories, getTrendingSearches } from "@/lib/data";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [announcements, campuses, categories, trending] = await Promise.all([
    getAnnouncements(),
    getCampuses(),
    getCategories(),
    getTrendingSearches(),
  ]);
  return (
    <html lang="en-ZA" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AnnouncementBar messages={announcements} />
        <SiteHeader campuses={campuses} />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <MenuDrawer campuses={campuses} categories={categories} />
        <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </body>
    </html>
  );
}
