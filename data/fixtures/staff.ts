import type { HubBookingRow, HubPostRow, MentorNoteRow, PickupPointRow } from "@/lib/data/rows";
import { hubPosts } from "./hub";
import { pickupPoints } from "./pickup-points";

// The staff tools' seeds (staff tools plan, Task 1; "Store design"): the pickup points and the Hub's posts as rows, so
// staff can change them (plan decisions 10 and 11), Naledi's two sample entries about Sipho's shop, and Thandi's
// sample slot request. Fixtures import nothing from lib at run time; these read the other fixtures. The words are
// samples for Lama to change (plan decision 22).

/** Midrand's office hours, which the seed gives to Naledi (acc-mentor), so her pages have something in them. */
const NALEDIS_POSTS: ReadonlySet<string> = new Set(["h-002", "h-007", "h-012"]);

/** When the sample pickup points were approved: before any sample listing. */
const POINTS_SINCE = "2025-01-15T08:00:00.000Z";

export const samplePickupPointRows: readonly PickupPointRow[] = pickupPoints.map((point) => ({
  id: point.id,
  campusSlug: point.campusSlug,
  name: point.name,
  retiredAt: null,
  createdAt: POINTS_SINCE,
}));

export const sampleHubPostRows: readonly HubPostRow[] = hubPosts.map((post) => ({
  ...post,
  image: { ...post.image },
  published: true,
  authorId: NALEDIS_POSTS.has(post.id) ? "acc-mentor" : null,
  createdAt: post.publishedAt,
  updatedAt: post.publishedAt,
}));

/** Naledi's check-in and note about Sipho (acc-seller), whose shop she mentors (data/fixtures/accounts.ts). */
export const sampleMentorNotes: readonly MentorNoteRow[] = [
  {
    id: "mn-s1",
    ownerId: "acc-seller",
    kind: "check-in",
    checkInOn: "2026-10-06",
    text: "Met Sipho at the Hub. We priced his calculators against new ones, and he'll list two more by Friday.",
    authorId: "acc-mentor",
    authorName: "Naledi",
    createdAt: "2026-10-06T12:30:00.000Z",
  },
  {
    id: "mn-s2",
    ownerId: "acc-seller",
    kind: "note",
    checkInOn: null,
    text: "Replies fast. Next: photos on a plain background, and a listing for the headset's case.",
    authorId: "acc-mentor",
    authorName: "Naledi",
    createdAt: "2026-10-13T15:10:00.000Z",
  },
];

/** Thandi's request for a slot at "Office hours: your first listing" (h-007), still waiting for an answer. */
export const sampleHubBookings: readonly HubBookingRow[] = [
  {
    id: "bk-s1",
    postId: "h-007",
    accountId: "acc-student",
    help: "I want to sell my braiding on Vossie and don't know how to write the listing or what to charge.",
    time: "Any time after 13:30",
    status: "open",
    createdAt: "2026-10-13T10:15:00.000Z",
    answeredAt: null,
    answeredBy: null,
  },
];
