import { describe, expect, it } from "vitest";
import type { EnquiryCounts } from "@/lib/types";
import { badgeProgress, earnedBadge, replyRate } from "./badges";

const NOW = new Date("2026-10-14T08:00:00.000Z");
const OLD_ACCOUNT = "2026-03-02T09:15:00.000Z";

const counts = (enquiries: number, due: number, repliedInTime: number, salesConfirmed: number): EnquiryCounts => ({
  enquiries,
  due,
  repliedInTime,
  salesConfirmed,
});

describe("reply rates (the trust page)", () => {
  it("is the share of due enquiries answered in time, or null while none is due", () => {
    expect(replyRate(counts(4, 4, 3, 0))).toBe(0.75);
    expect(replyRate(counts(2, 0, 0, 0))).toBeNull();
  });
});

describe("what the next badge needs (selling spec 2.8, plan decision 18)", () => {
  it("counts what's missing for Trusted, as the spec's example does", () => {
    expect(badgeProgress("responsive", counts(2, 2, 2, 0), OLD_ACCOUNT, NOW)).toBe(
      "1 more enquiry and 5 more confirmed sales for Trusted.",
    );
    expect(badgeProgress("responsive", counts(4, 4, 4, 3), OLD_ACCOUNT, NOW)).toBe("2 more confirmed sales for Trusted.");
  });

  it("starts a new seller on Responsive", () => {
    expect(badgeProgress("new-seller", counts(0, 0, 0, 0), OLD_ACCOUNT, NOW)).toBe("3 more enquiries for Responsive.");
    expect(badgeProgress(null, counts(1, 1, 1, 0), OLD_ACCOUNT, NOW)).toBe("2 more enquiries for Responsive.");
  });

  it("says when replies are too slow, with the rate now", () => {
    expect(badgeProgress("new-seller", counts(4, 4, 3, 0), OLD_ACCOUNT, NOW)).toBe(
      "80% of enquiries answered within 48 hours (now 75%) for Responsive.",
    );
  });

  it("rounds the rate now down, so it never shows the target before it's met (amendment 8.7)", () => {
    expect(badgeProgress("new-seller", counts(49, 49, 39, 0), OLD_ACCOUNT, NOW)).toBe(
      "80% of enquiries answered within 48 hours (now 79%) for Responsive.",
    );
    expect(badgeProgress("new-seller", counts(100, 100, 57, 0), OLD_ACCOUNT, NOW)).toBe(
      "80% of enquiries answered within 48 hours (now 57%) for Responsive.",
    );
  });

  it("asks for replies when there are enough enquiries but none has come due yet", () => {
    expect(badgeProgress("new-seller", counts(3, 0, 0, 0), OLD_ACCOUNT, NOW)).toBe(
      "80% of enquiries answered within 48 hours for Responsive.",
    );
  });

  it("counts the days a new account still needs for Trusted", () => {
    expect(badgeProgress("responsive", counts(3, 3, 3, 5), "2026-10-04T08:00:00.000Z", NOW)).toBe(
      "20 more days on CampusCart for Trusted.",
    );
  });

  it("says when the rules are met, and when there's nothing higher", () => {
    expect(badgeProgress("responsive", counts(5, 5, 5, 6), OLD_ACCOUNT, NOW)).toBe(
      "You meet the rules for Trusted. Your badge changes when the Hub next updates badges.",
    );
    expect(badgeProgress("trusted", counts(0, 0, 0, 0), OLD_ACCOUNT, NOW)).toBe(
      "Trusted is the highest badge. Keep replying quickly to keep it.",
    );
  });
});

describe("the badge a shop has earned (staff tools spec 2.7, the trust page's rules)", () => {
  it("is New seller until 3 enquiries in 90 days are answered at 80% within 48 hours", () => {
    expect(earnedBadge(counts(2, 2, 2, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
    expect(earnedBadge(counts(3, 0, 0, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
    expect(earnedBadge(counts(5, 5, 3, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
    expect(earnedBadge(counts(5, 5, 4, 0), OLD_ACCOUNT, NOW)).toBe("responsive");
  });

  it("is Trusted at 85%, 5 confirmed sales and a 30-day-old account, and Responsive one short of any of them", () => {
    expect(earnedBadge(counts(20, 20, 17, 5), OLD_ACCOUNT, NOW)).toBe("trusted");
    expect(earnedBadge(counts(20, 20, 16, 5), OLD_ACCOUNT, NOW)).toBe("responsive");
    expect(earnedBadge(counts(20, 20, 17, 4), OLD_ACCOUNT, NOW)).toBe("responsive");
    expect(earnedBadge(counts(20, 20, 17, 5), "2026-09-14T08:00:00.000Z", NOW)).toBe("trusted");
    expect(earnedBadge(counts(20, 20, 17, 5), "2026-09-14T08:00:01.000Z", NOW)).toBe("responsive");
  });

  it("is Responsive at exactly 3 enquiries when all are answered, and still New seller at 2 (the limit from both sides)", () => {
    expect(earnedBadge(counts(3, 3, 3, 0), OLD_ACCOUNT, NOW)).toBe("responsive");
    expect(earnedBadge(counts(2, 2, 2, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
  });

  it("goes down again when the record does (a badge can go down, the trust page)", () => {
    expect(earnedBadge(counts(0, 0, 0, 9), OLD_ACCOUNT, NOW)).toBe("new-seller");
  });
});
