import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AnnouncementBar } from "@/components/announcement/AnnouncementBar";
import { CampusPicker } from "@/components/campus/CampusPicker";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { AccountLink, HeaderAccount } from "@/components/header/AccountLink";
import { PhoneSaved } from "@/components/header/PhoneSaved";
import { SiteHeader } from "@/components/header/SiteHeader";
import { MenuAccount, MenuAccountLinks } from "@/components/menu/MenuAccount";
import { MenuDrawer } from "@/components/menu/MenuDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { RoleTabs, StudentTail, TabBar } from "@/components/tabbar/TabBar";
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
    default: "CampusCart · The Eduvos student marketplace",
    template: "%s · CampusCart",
  },
  description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
  applicationName: "CampusCart",
  appleWebApp: {
    capable: true,
    title: "CampusCart",
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
        <SiteHeader
          campuses={campuses}
          account={
            // The session is read per request, so the icon streams in; the static shell says "Sign in" (accounts plan
            // decision 1). The layout never awaits the session itself, so every page keeps its static shell.
            <Suspense fallback={<AccountLink signedIn={false} />}>
              <HeaderAccount />
            </Suspense>
          }
          phoneSaved={
            <Suspense fallback={null}>
              <PhoneSaved />
            </Suspense>
          }
        />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter campuses={campuses} />
        <TabBar
          tail={
            // Streams in like the header's icon (role bars spec 5): the static shell is the student's bar, linking to
            // sign-in, and a seller's or staff's slots swap in once, on a full page load.
            <Suspense fallback={<StudentTail />}>
              <RoleTabs />
            </Suspense>
          }
        />
        <MenuDrawer
          campuses={campuses}
          categories={categories}
          account={
            <Suspense fallback={<MenuAccountLinks signedIn={false} />}>
              <MenuAccount />
            </Suspense>
          }
        />
        <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </body>
    </html>
  );
}
