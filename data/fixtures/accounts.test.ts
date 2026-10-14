import { describe, expect, it } from "vitest";
import { sampleAccounts, sampleConsents } from "./accounts";
import { campuses } from "./campuses";
import { sellers } from "./sellers";

const campusSlugs = new Set(campuses.map((campus) => campus.slug));
const sellersBySlug = new Map(sellers.map((seller) => [seller.slug, seller]));

describe("sample accounts (accounts spec 2.8)", () => {
  it("has the five sample accounts, all at eduvos.com, with unique ids", () => {
    expect(sampleAccounts.map(({ account }) => account.email)).toEqual([
      "student@eduvos.com",
      "seller@eduvos.com",
      "pending@eduvos.com",
      "mentor@eduvos.com",
      "admin@eduvos.com",
    ]);
    const ids = sampleAccounts.map(({ account }) => account.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives each the role the spec names", () => {
    const byEmail = new Map(sampleAccounts.map((sample) => [sample.account.email, sample]));
    expect(byEmail.get("student@eduvos.com")?.seller).toBeNull();
    expect(byEmail.get("student@eduvos.com")?.account.roles).toEqual([]);
    expect(byEmail.get("seller@eduvos.com")?.seller).toMatchObject({ status: "approved", sellerSlug: "tech-corner" });
    expect(byEmail.get("pending@eduvos.com")?.seller).toMatchObject({ status: "pending", sellerSlug: null });
    expect(byEmail.get("mentor@eduvos.com")?.account.roles).toEqual(["mentor"]);
    expect(byEmail.get("admin@eduvos.com")?.account.roles).toEqual(["admin"]);
  });

  it("puts every account on a real campus, and a shop on its owner's real storefront", () => {
    for (const { account, seller } of sampleAccounts) {
      expect(campusSlugs.has(account.campusSlug), account.email).toBe(true);
      expect(account.firstName.length, account.email).toBeGreaterThanOrEqual(2);
      if (!seller) continue;
      expect(seller.accountId, account.email).toBe(account.id);
      if (seller.sellerSlug) expect(sellersBySlug.get(seller.sellerSlug)?.campusSlug, account.email).toBe(account.campusSlug);
    }
  });

  it("labels each sign-in button differently", () => {
    const labels = sampleAccounts.map((sample) => sample.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("records each account's consent to the October 2026 draft of the privacy policy", () => {
    expect(sampleConsents.map((consent) => consent.accountId)).toEqual(sampleAccounts.map(({ account }) => account.id));
    for (const consent of sampleConsents) expect(consent.version).toBe("2026-10-draft");
  });
});
