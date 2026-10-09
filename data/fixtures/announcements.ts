import type { Announcement } from "@/lib/types";

export const announcements: readonly Announcement[] = [
  { id: "live", tag: "New", text: "Live on all 12 Eduvos campuses · Free to list", href: "/sell" },
  { id: "safety", tag: "Safety", text: "Meet at a campus pickup point and never pay before you see it", href: "/safety" },
  { id: "hub", tag: "Hub", text: "Verified Incubation Hub sellers on every campus", href: "/hub" },
];
