import { beforeEach, describe, expect, it } from "vitest";
import { FORMER_STAFF } from "@/lib/staff/audit-words";
import { addPin, featuredChoices, featuredFor, listPins, previewFeatured, removePin } from "./featured";
import type { FeaturedPinRow } from "./rows";
import { resetSampleStore, sampleStore } from "./store";

const DAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const pin = (sellerSlug: string, campusSlug = "pretoria", day = DAY) =>
  addPin({ sellerSlug, campusSlug, day, staffId: "acc-admin", now: NOW });
const slugsOf = (sellers: readonly { slug: string }[]) => sellers.map((seller) => seller.slug);

beforeEach(() => {
  resetSampleStore();
});

describe("who can be featured (staff tools spec 2.8, plan decision 9)", () => {
  it("offers Verified, open sellers with something listed, by name", async () => {
    const slugs = async () => slugsOf(await featuredChoices());
    expect(await slugs()).toHaveLength(9);
    const names = (await featuredChoices()).map((seller) => seller.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect(await slugs()).toContain("tech-corner");
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await slugs()).not.toContain("tech-corner");
    for (const listing of sampleStore().listings.values()) {
      if (listing.sellerSlug === "hair-studio") listing.state = "sold";
    }
    expect(await slugs()).not.toContain("hair-studio");
  });
});

describe("a campus's Featured row for the day (staff tools spec 2.8, plan decision 9)", () => {
  it("draws four, the campus's own first, and records the row", async () => {
    const row = await featuredFor("midrand", DAY);
    expect(row).toHaveLength(4);
    expect(row.every((seller) => seller.verified && seller.campusSlug === "midrand")).toBe(true);
    expect(sampleStore().featuredDraws.get("midrand:2026-10-14")?.sellerSlugs).toEqual(slugsOf(row));
  });

  it("keeps the row as first drawn all day, and drops a seller who stops being eligible, leaving the place empty", async () => {
    const first = await featuredFor("midrand", DAY);
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect(await featuredFor("midrand", DAY)).toEqual(first);
    sampleStore().sellers.get(first[0].slug)!.verified = false;
    expect(slugsOf(await featuredFor("midrand", DAY))).toEqual(slugsOf(first.slice(1)));
  });

  it("rests a campus's sellers for six days after they're shown there, filling the row from them when it must", async () => {
    const day1 = slugsOf(await featuredFor("midrand", "2026-10-14"));
    const day2 = slugsOf(await featuredFor("midrand", "2026-10-15"));
    expect(day2).toHaveLength(4);
    expect(day2.some((slug) => day1.includes(slug))).toBe(false);
    // Nine sellers, four places: day 3 has the one not shown yet, then three of day 1's, shown longest ago (amendment 14).
    const day3 = slugsOf(await featuredFor("midrand", "2026-10-16"));
    expect(day3).toHaveLength(4);
    const unseen = slugsOf(await featuredChoices()).filter((slug) => !day1.includes(slug) && !day2.includes(slug));
    expect(unseen).toHaveLength(1);
    expect(day3[0]).toBe(unseen[0]);
    expect(day3.slice(1).every((slug) => day1.includes(slug))).toBe(true);
    // The row stays full every day while four or more sellers can be featured.
    for (const day of ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]) {
      expect(await featuredFor("midrand", day), day).toHaveLength(4);
    }
    // The break is the campus's own: Pretoria's first row is its usual draw.
    expect(slugsOf(await featuredFor("pretoria", "2026-10-15")).slice(0, 2).sort()).toEqual(["code-coach", "thrift-rack"]);
  });

  it("puts pins first, even a resting seller, and draws again when a pin for the day comes or goes", async () => {
    const first = await featuredFor("pretoria", DAY);
    const added = await pin("nail-bar");
    expect(added).toMatchObject({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: DAY, pinnedBy: "acc-admin" });
    expect((await featuredFor("pretoria", DAY))[0].slug).toBe("nail-bar");
    await removePin((added as FeaturedPinRow).id);
    expect(await featuredFor("pretoria", DAY)).toEqual(first);
    // Shown in Pretoria's row today, Code coach rests there tomorrow, but a pin still puts it first.
    expect(slugsOf(first)).toContain("code-coach");
    const tomorrow = "2026-10-15";
    await pin("code-coach", "pretoria", tomorrow);
    expect((await featuredFor("pretoria", tomorrow))[0].slug).toBe("code-coach");
  });

  it("tidies rows and pins more than a week old away as new rows are drawn", async () => {
    await featuredFor("midrand", "2026-10-01");
    await pin("nail-bar", "midrand", "2026-10-01");
    await featuredFor("midrand", "2026-10-07");
    await featuredFor("midrand", DAY);
    expect([...sampleStore().featuredDraws.keys()].sort()).toEqual(["midrand:2026-10-07", "midrand:2026-10-14"]);
    expect(sampleStore().featuredPins.size).toBe(0);
  });
});

describe("the admin's preview of a row (staff tools plan amendment 22)", () => {
  it("shows the recorded row, or what the draw would give, and records nothing", async () => {
    const preview = await previewFeatured("midrand", DAY);
    expect(preview).toHaveLength(4);
    expect(sampleStore().featuredDraws.size).toBe(0);
    expect(await featuredFor("midrand", DAY)).toEqual(preview);
    // Once recorded, the preview is the recorded row, even when a new draw would differ.
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect(await previewFeatured("midrand", DAY)).toEqual(preview);
    // A later day's preview counts the recorded row's break, still without recording.
    const tomorrow = slugsOf(await previewFeatured("midrand", "2026-10-15"));
    expect(tomorrow.some((slug) => slugsOf(preview).includes(slug))).toBe(false);
    expect(sampleStore().featuredDraws.has("midrand:2026-10-15")).toBe(false);
  });
});

describe("pins (staff tools spec 2.8)", () => {
  it("refuses a seller who can't be featured, the same seller twice, and a fifth pin", async () => {
    expect(await pin("tech-corner")).toBe("not-eligible");
    expect(await pin("nope")).toBe("not-eligible");
    for (const slug of ["hair-studio", "maths-tutor", "home-bakery", "design-studio"]) {
      expect(typeof (await pin(slug)), slug).toBe("object");
    }
    expect(await pin("hair-studio")).toBe("taken");
    expect(await pin("code-coach")).toBe("full");
    expect(typeof (await pin("code-coach", "pretoria", "2026-10-15"))).toBe("object");
  });

  it("lists today's and later pins with the seller's and the admin's names", async () => {
    await pin("nail-bar", "pretoria", "2026-10-13");
    await pin("nail-bar", "all", "2026-10-20");
    await pin("phone-fix", "pretoria", DAY);
    expect(await listPins(DAY)).toEqual([
      expect.objectContaining({ sellerName: "Phone fix", campusSlug: "pretoria", day: DAY, pinnedByName: "Pieter" }),
      expect.objectContaining({ sellerName: "Nail bar", campusSlug: "all", day: "2026-10-20" }),
    ]);
    expect(await removePin("pin-nope")).toBeNull();
  });

  it("names a pin whose admin has gone as a former staff member (amendment 17)", async () => {
    const added = (await pin("phone-fix")) as FeaturedPinRow;
    sampleStore().featuredPins.get(added.id)!.pinnedBy = null;
    expect((await listPins(DAY))[0].pinnedByName).toBe(FORMER_STAFF);
  });
});
