import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleAccounts, sampleConsents } from "@/data/fixtures/accounts";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { sampleConversations, sampleMessages, sampleNotifications } from "@/data/fixtures/messages";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { sampleListingRows, sampleSellerRows, sampleShopOwners } from "@/data/fixtures/shops";
import { makeSeedSql, seedEmail, seedUuid, type SeedFixtures } from "./seed-sql";

const fixtures: SeedFixtures = {
  campuses,
  categories,
  pickupPoints,
  accounts: sampleAccounts,
  consents: sampleConsents,
  shopOwners: sampleShopOwners,
  shops: sampleSellerRows,
  listings: sampleListingRows,
  conversations: sampleConversations,
  messages: sampleMessages,
  notifications: sampleNotifications,
};

describe("supabase/seed.sql (supabase foundation plan, Task 11)", () => {
  it("is what the fixtures make: run `pnpm db:seed` after changing a fixture", () => {
    const onDisk = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");
    expect(onDisk === makeSeedSql(fixtures), "supabase/seed.sql is out of date: run `pnpm db:seed`").toBe(true);
  });

  it("holds every sample shop, listing and account, with the listings' own ids", () => {
    const sql = makeSeedSql(fixtures);
    for (const shop of sampleSellerRows) expect(sql).toContain(`'${shop.slug}'`);
    for (const listing of sampleListingRows) expect(sql).toContain(`('${listing.id}', '${seedUuid("shop", listing.sellerSlug)}'`);
    for (const { account } of sampleAccounts) {
      expect(sql).toContain(`'${seedUuid("account", account.id)}', 'authenticated', 'authenticated', '${seedEmail(account.email)}'`);
    }
    expect(sql).toContain("insert into private.allowed_email_domains (domain) values\n  ('eduvos.com'),\n  ('vossie.test');");
  });

  it("gives the five sample accounts, admin and mentor included, addresses on the reserved test domain", () => {
    const sql = makeSeedSql(fixtures);
    expect(sampleAccounts.map(({ account }) => seedEmail(account.email))).toEqual([
      "student@vossie.test",
      "seller@vossie.test",
      "pending@vossie.test",
      "mentor@vossie.test",
      "admin@vossie.test",
    ]);
    // No real-looking Eduvos address anywhere in the seed: the fixtures keep theirs for sample mode only.
    expect(sql).not.toMatch(/[a-z0-9._%+-]+@eduvos\.com/i);
    for (const { account } of sampleAccounts) expect(account.email).toMatch(/@eduvos\.com$/);
  });

  it("links each notification to its conversation's new id", () => {
    const sql = makeSeedSql(fixtures);
    for (const row of sampleNotifications) {
      expect(sql).toContain(`'/messages/${seedUuid("conversation", row.subjectId)}'`);
    }
    expect(sql).not.toContain("/messages/conv-");
  });

  it("makes the same uuid for the same id every time, shaped as a version 5 uuid", () => {
    expect(seedUuid("account", "acc-student")).toBe(seedUuid("account", "acc-student"));
    expect(seedUuid("account", "acc-student")).not.toBe(seedUuid("shop", "acc-student"));
    expect(seedUuid("shop", "tech-corner")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("writes text with line breaks and quotes as SQL literals that keep them", () => {
    const sql = makeSeedSql(fixtures);
    // Sipho's reply has a line break, and Thandi's message an apostrophe.
    expect(sql).toContain("E'Hi Thandi, it is. Can I see the speaker first?\\nI''m at the library entrance after 12:00 most days.'");
    expect(sql).toContain("'Hi! Is the headset still available? I''d like to swap for it if you''re open to that.'");
  });
});
