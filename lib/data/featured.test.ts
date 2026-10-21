import { beforeEach, describe, expect, it } from "vitest";
import { addPin, featuredChoices, featuredFor, getPin, listPins, removePin } from "./featured";
import type { FeaturedPinRow } from "./rows";
import { resetSampleStore, sampleStore } from "./store";

const DAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const pin = (sellerSlug: string, campusSlug = "pretoria", day = DAY) =>
  addPin({ sellerSlug, campusSlug, day, staffId: "acc-admin", now: NOW });

beforeEach(() => {
  resetSampleStore();
});

describe("who can be featured (staff tools spec 2.8, plan decision 9)", () => {
  it("offers Verified, open sellers with something listed, by name", async () => {
    const slugs = async () => (await featuredChoices()).map((seller) => seller.slug);
    expect(await slugs()).toHaveLength(9);
    expect((await featuredChoices()).map((seller) => seller.name)).toEqual(
      [...(await featuredChoices()).map((seller) => seller.name)].sort((a, b) => a.localeCompare(b)),
    );
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
    expect(sampleStore().featuredDraws.get("midrand:2026-10-14")?.sellerSlugs).toEqual(row.map((seller) => seller.slug));
  });

  it("keeps the row as first drawn all day, and drops a seller who stops being eligible, leaving the place empty", async () => {
    const first = await featuredFor("midrand", DAY);
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect(await featuredFor("midrand", DAY)).toEqual(first);
    sampleStore().sellers.get(first[0].slug)!.verified = false;
    expect((await featuredFor("midrand", DAY)).map((seller) => seller.slug)).toEqual(
      first.slice(1).map((seller) => seller.slug),
    );
  });

  it("rests a campus's sellers after they're shown there, as a preference, and not on other campuses", async () => {
    const day1 = (await featuredFor("midrand", "2026-10-14")).map((seller) => seller.slug);
    const day2 = (await featuredFor("midrand", "2026-10-15")).map((seller) => seller.slug);
    expect(day2).toHaveLength(4);
    expect(day2.some((slug) => day1.includes(slug))).toBe(false);
    // Nine sellers, four places: day 3 leads with the one seller shown on neither day, then the rested ones fill the
    // row, so it is never short (plan amendment 3: the break is a preference, not a rule).
    const everyone = (await featuredChoices()).map((seller) => seller.slug);
    const left = everyone.filter((slug) => !day1.includes(slug) && !day2.includes(slug));
    expect(left).toHaveLength(1);
    const day3 = (await featuredFor("midrand", "2026-10-16")).map((seller) => seller.slug);
    expect(day3).toHaveLength(4);
    expect(day3[0]).toBe(left[0]);
    expect(await featuredFor("midrand", "2026-10-17")).toHaveLength(4);
    expect(await featuredFor("pretoria", "2026-10-15")).toHaveLength(4);
  });

  it("puts pins first, even a resting seller, and draws again when a pin for the day comes or goes", async () => {
    const first = await featuredFor("pretoria", DAY);
    const added = await pin("nail-bar");
    expect(added).toMatchObject({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: DAY, pinnedBy: "acc-admin" });
    expect((await featuredFor("pretoria", DAY))[0].slug).toBe("nail-bar");
    await removePin((added as FeaturedPinRow).id);
    expect(await featuredFor("pretoria", DAY)).toEqual(first);
    // Shown in Pretoria's row today, Code coach rests there tomorrow, but a pin still puts it first.
    const tomorrow = "2026-10-15";
    await pin("code-coach", "pretoria", tomorrow);
    expect((await featuredFor("pretoria", tomorrow))[0].slug).toBe("code-coach");
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
});

describe("an admin's own shop on Featured (stage L spec decision 1)", () => {
  it("leaves the viewer's own shop out of the choices, and marks its pins", async () => {
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect((await featuredChoices()).map((seller) => seller.slug)).toContain("tech-corner");
    expect((await featuredChoices("acc-seller")).map((seller) => seller.slug)).not.toContain("tech-corner");
    expect(await featuredChoices("acc-admin")).toEqual(await featuredChoices());
    const made = await pin("tech-corner");
    if (typeof made === "string") throw new Error(`The pin wasn't made: ${made}`);
    expect((await listPins(DAY, "acc-seller")).map((view) => [view.sellerSlug, view.own])).toEqual([["tech-corner", true]]);
    expect((await listPins(DAY, "acc-admin"))[0].own).toBe(false);
    expect((await listPins(DAY))[0].own).toBe(false);
  });

  it("finds one pin by id, for Remove's check of whose shop it is", async () => {
    const made = await pin("nail-bar");
    if (typeof made === "string") throw new Error(`The pin wasn't made: ${made}`);
    expect(await getPin(made.id)).toEqual(made);
    expect(await getPin("pin-nope")).toBeNull();
  });
});

describe("the resting sellers who waited longest come back first (stage M spec decisions 9 to 11)", () => {
  /** A recorded row for "all", as featuredFor stores one. */
  const record = (day: string, sellerSlugs: string[]) =>
    sampleStore().featuredDraws.set(`all:${day}`, { key: `all:${day}`, campusSlug: "all", day, sellerSlugs });
  /** The nine sellers who may be featured, in the order drawFeatured sorts them. */
  const everyone = async () =>
    (await featuredChoices()).map((seller) => seller.slug).sort((a, b) => a.localeCompare(b));

  it("rests a seller with the latest day it was shown: shown five days ago and yesterday, it waited one day", async () => {
    const e = await everyone();
    expect(e).toHaveLength(9);
    record("2026-10-09", [e[0], e[1], e[2], e[3]]);
    record("2026-10-11", [e[4], e[5], e[6], e[7]]);
    record("2026-10-13", [e[8], e[0], e[1], e[2]]);
    // Everyone is resting. e[3] was shown on the 9th only, so it comes back first; then the 11th's, in the day's
    // rotation (on 14 October it starts at place 4 of 9). e[0] to e[2] count from the 13th, not the 9th.
    expect((await featuredFor("all", DAY)).map((seller) => seller.slug)).toEqual([e[3], e[4], e[5], e[6]]);
  });

  it("fills a nine-seller walk's resting places from the oldest row", async () => {
    const day1 = (await featuredFor("all", "2026-10-14")).map((seller) => seller.slug);
    const day2 = (await featuredFor("all", "2026-10-15")).map((seller) => seller.slug);
    const day3 = (await featuredFor("all", "2026-10-16")).map((seller) => seller.slug);
    expect(day2.some((slug) => day1.includes(slug))).toBe(false);
    // Day 3: the one seller shown on neither day, then three of day 1's, never day 2's.
    expect(day3).toHaveLength(4);
    expect(day3.slice(1).every((slug) => day1.includes(slug))).toBe(true);
  });

  it("counts a pinned day as a featured day: pins are in the recorded row (passes at HEAD)", async () => {
    const e = await everyone();
    await pin(e[0], "all", "2026-10-13");
    expect((await featuredFor("all", "2026-10-13"))[0].slug).toBe(e[0]);
    expect((await featuredFor("all", DAY)).map((seller) => seller.slug)).not.toContain(e[0]);
  });
});
