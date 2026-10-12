import type { HubBanner, HubEvent } from "@/lib/types";

export const hubBanner: HubBanner = {
  image: { src: "/placeholders/hub/banner.svg", alt: "" },
};

// Upcoming Incubation Hub events. "all" means every campus.
export const hubEvents: readonly HubEvent[] = [
  { id: "e-001", date: "2026-10-14", title: "Pitch night", campusSlug: "all", action: "rsvp" },
  { id: "e-002", date: "2026-10-15", title: "Office hours: pricing your hustle", campusSlug: "midrand", action: "book" },
  { id: "e-003", date: "2026-10-20", title: "Market day on the lawn", campusSlug: "pretoria", action: "rsvp" },
  { id: "e-004", date: "2026-10-22", title: "Photo day for your shop", campusSlug: "bedfordview", action: "book" },
  { id: "e-005", date: "2026-10-28", title: "Hub mixer", campusSlug: "all", action: "rsvp" },
];
