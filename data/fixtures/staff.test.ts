import { describe, expect, it } from "vitest";
import { sampleAccounts } from "./accounts";
import { hubPosts } from "./hub";
import { pickupPoints } from "./pickup-points";
import { sampleHubBookings, sampleHubPostRows, sampleMentorNotes, samplePickupPointRows } from "./staff";

const accounts = new Map(sampleAccounts.map((sample) => [sample.account.id, sample]));

describe("the staff tools' seeds (staff tools plan, Task 1)", () => {
  it("turns every pickup point into a row in use, with the same id, campus and name", () => {
    expect(samplePickupPointRows.map(({ id, campusSlug, name }) => ({ id, campusSlug, name }))).toEqual(
      pickupPoints.map(({ id, campusSlug, name }) => ({ id, campusSlug, name })),
    );
    expect(samplePickupPointRows.every((row) => row.retiredAt === null)).toBe(true);
  });

  it("turns every Hub post into a published row, and gives Midrand's office hours to Naledi (plan decision 11)", () => {
    expect(sampleHubPostRows.map((row) => row.id)).toEqual(hubPosts.map((post) => post.id));
    expect(sampleHubPostRows.every((row) => row.published && row.publishedAt === row.createdAt)).toBe(true);
    const nalediPosts = sampleHubPostRows.filter((row) => row.authorId === "acc-mentor").map((row) => row.id);
    expect(nalediPosts).toEqual(["h-002", "h-007", "h-012"]);
    for (const id of nalediPosts) {
      expect(hubPosts.find((post) => post.id === id)).toMatchObject({ kind: "office-hours", campusSlug: "midrand" });
    }
    const pitchNight = sampleHubPostRows[0];
    expect(pitchNight).toMatchObject({ ...hubPosts[0], authorId: null, published: true });
  });

  it("writes Naledi's entries about the owner of the shop she mentors (plan decision 16)", () => {
    expect(sampleMentorNotes.map((row) => row.kind)).toEqual(["check-in", "note"]);
    for (const note of sampleMentorNotes) {
      const author = accounts.get(note.authorId ?? "");
      expect(author?.account.roles, note.id).toContain("mentor");
      expect(note.authorName, note.id).toBe(author?.account.firstName);
      const owner = accounts.get(note.ownerId);
      expect(owner?.seller, note.id).toMatchObject({ status: "approved", mentorId: note.authorId });
      if (note.kind === "check-in") expect(note.checkInOn, note.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(note.checkInOn, note.id).toBeNull();
    }
  });

  it("asks for a slot at Midrand's office hours as Thandi, still open", () => {
    expect(sampleHubBookings).toHaveLength(1);
    const [booking] = sampleHubBookings;
    expect(booking).toMatchObject({ postId: "h-007", accountId: "acc-student", status: "open", answeredAt: null });
    expect(hubPosts.find((post) => post.id === booking.postId)?.kind).toBe("office-hours");
    expect([...booking.help].length).toBeLessThanOrEqual(300);
    expect([...booking.time].length).toBeLessThanOrEqual(100);
  });
});
