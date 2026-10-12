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
  { id: "e-006", date: "2026-11-05", title: "Selling online: photos that sell", campusSlug: "all", action: "rsvp" },
  { id: "e-007", date: "2026-11-19", title: "Office hours: your first listing", campusSlug: "midrand", action: "book" },
  { id: "e-008", date: "2026-12-03", title: "End-of-year market", campusSlug: "all", action: "rsvp" },
  { id: "e-009", date: "2027-01-28", title: "Back-to-campus pop-up", campusSlug: "pretoria", action: "rsvp" },
  { id: "e-010", date: "2027-02-11", title: "Pitch night", campusSlug: "all", action: "rsvp" },
];
