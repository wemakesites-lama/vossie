import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleAccounts, sampleConsents } from "@/data/fixtures/accounts";
import { sampleConversations, sampleMessages, sampleNotifications } from "@/data/fixtures/messages";
import { sampleRequestRows } from "@/data/fixtures/request-rows";
import { sampleListingRows, sampleSellerRows, sampleShopOwners } from "@/data/fixtures/shops";
import { sampleHubBookings, sampleHubPostRows, sampleMentorNotes, samplePickupPointRows } from "@/data/fixtures/staff";
import { makeSeedSql, seedEmail, seedUuid, type SeedFixtures } from "./seed-sql";

const fixtures: SeedFixtures = {
  pickupPoints: samplePickupPointRows,
  accounts: sampleAccounts,
  consents: sampleConsents,
  shopOwners: sampleShopOwners,
  shops: sampleSellerRows,
  listings: sampleListingRows,
  conversations: sampleConversations,
  messages: sampleMessages,
  notifications: sampleNotifications,
  requests: sampleRequestRows,
  hubPosts: sampleHubPostRows,
  mentorNotes: sampleMentorNotes,
  hubBookings: sampleHubBookings,
};

/** The rows of one table's INSERT, one string a row (each value list without its parentheses' line indent). */
function rowsOf(sql: string, table: string): string[] {
  const start = sql.indexOf(`insert into ${table} (`);
  if (start < 0) return [];
  const end = sql.indexOf(";\n", start);
  return sql
    .slice(start, end)
    .split("\n")
    .slice(1)
    .map((line) => line.trim().replace(/,$/, ""));
}

/** The column list of one table's INSERT. */
function columnsOf(sql: string, table: string): string[] {
  const match = new RegExp(`insert into ${table.replace(".", "\\.")} \\(([^)]*)\\) values`).exec(sql);
  return match ? match[1].split(", ") : [];
}

const q = (text: string) => `'${text.replace(/'/g, "''")}'`;

describe("supabase/seed.sql (supabase foundation plan, Task 11; schema catch-up plan, Task 10)", () => {
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
    // Production's domains (eduvos.com, vossie.net) come from the reference migration; the seed adds only its test domain.
    expect(sql).toContain("insert into private.allowed_email_domains (domain) values\n  ('vossie.test');");
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

  it("leaves the campuses, categories and pickup points to the reference migration (step 2b plan, Task 1)", () => {
    const sql = makeSeedSql(fixtures);
    expect(sql).not.toContain("insert into public.campuses");
    expect(sql).not.toContain("insert into public.categories");
    expect(sql).not.toContain("insert into public.pickup_points");
    // The shops' and listings' pickup points are the reference migration's, by the same fixed ids.
    expect(rowsOf(sql, "public.shop_pickup_points").length).toBeGreaterThan(0);
    for (const row of rowsOf(sql, "public.shop_pickup_points")) {
      expect(samplePickupPointRows.map((point) => `'${seedUuid("pickup-point", point.id)}'`)).toContain(row.split(", ")[1].replace(/\)$/, ""));
    }
  });

  it("refuses a shop or listing on a pickup point the reference rows don't have", () => {
    const [shop] = sampleSellerRows;
    expect(() => makeSeedSql({ ...fixtures, shops: [{ ...shop, pickupPointIds: ["pp-nowhere"] }, ...sampleSellerRows.slice(1)] })).toThrow(
      /pp-nowhere/,
    );
    const listing = sampleListingRows.find((row) => row.pickupPointId)!;
    expect(() =>
      makeSeedSql({ ...fixtures, listings: sampleListingRows.map((row) => (row === listing ? { ...row, pickupPointId: "pp-nowhere" } : row)) }),
    ).toThrow(/pp-nowhere/);
  });

  it("gives Tech corner's profile its mentor and first approval, and the waiting shop neither", () => {
    const sql = makeSeedSql(fixtures);
    expect(columnsOf(sql, "public.seller_profiles")).toEqual([
      "account_id",
      "status",
      "shop_id",
      "applied_at",
      "declined_at",
      "paused_by",
      "seller_paused_too",
      "staff_reason",
      "mentor_id",
      "approved_at",
    ]);
    expect(rowsOf(sql, "public.seller_profiles")).toEqual([
      `('${seedUuid("account", "acc-seller")}', 'approved', '${seedUuid("shop", "tech-corner")}', '2026-03-02T09:40:00.000Z', null, null, false, null, '${seedUuid("account", "acc-mentor")}', '2026-03-01T08:00:00.000Z')`,
      `('${seedUuid("account", "acc-pending")}', 'pending', '${seedUuid("shop", "crochet-corner")}', '2026-10-10T12:20:00.000Z', null, null, false, null, null, null)`,
    ]);
  });

  it("holds the 16 Looking For requests with no asker, their offer numbers, and the two closed ones as they are", () => {
    const sql = makeSeedSql(fixtures);
    const rows = rowsOf(sql, "public.requests");
    expect(columnsOf(sql, "public.requests")).toEqual([
      "id",
      "asker_id",
      "title",
      "category_slug",
      "campus_slug",
      "details",
      "budget_zar",
      "swap_welcome",
      "needed_by",
      "status",
      "created_at",
      "updated_at",
      "closed_at",
      "seed_offers",
      "hidden_at",
      "hidden_reason",
    ]);
    expect(rows).toHaveLength(16);
    sampleRequestRows.forEach((request, i) => {
      expect(rows[i].startsWith(`(${q(request.id)}, null, ${q(request.title)}, ${q(request.categorySlug)}, ${q(request.campusSlug)}, `)).toBe(true);
      expect(rows[i].endsWith(`, ${q(request.status)}, ${q(request.createdAt)}, ${q(request.createdAt)}, null, ${request.seedOffers}, null, null)`)).toBe(true);
    });
    expect(rows.filter((row) => row.includes(", 'closed', ")).map((row) => row.slice(1, 8))).toEqual(["'r-015'", "'r-016'"]);
  });

  it("holds the Hub's 18 posts, every campus as null, Naledi's three, and their placeholder art", () => {
    const sql = makeSeedSql(fixtures);
    const rows = rowsOf(sql, "public.hub_posts");
    expect(columnsOf(sql, "public.hub_posts")).toEqual([
      "id",
      "kind",
      "title",
      "summary",
      "place",
      "body",
      "campus_slug",
      "starts_at",
      "capacity",
      "going",
      "image_src",
      "image_alt",
      "published",
      "published_at",
      "author_id",
      "created_at",
      "updated_at",
    ]);
    expect(rows).toHaveLength(18);
    const naledi = seedUuid("account", "acc-mentor");
    sampleHubPostRows.forEach((post, i) => {
      expect(rows[i].startsWith(`(${q(post.id)}, ${q(post.kind)}, ${q(post.title)}, `)).toBe(true);
      expect(rows[i]).toContain(`, '/placeholders/hub/${post.id}.svg', '', true, ${q(post.publishedAt ?? "")}, `);
      const author = ["h-002", "h-007", "h-012"].includes(post.id) ? q(naledi) : "null";
      expect(rows[i].endsWith(`, ${author}, ${q(post.createdAt)}, ${q(post.updatedAt)})`)).toBe(true);
    });
    expect(sql).not.toContain("'all'");
    expect(rows.filter((row) => row.includes(`'${naledi}'`))).toHaveLength(3);
  });

  it("holds Naledi's two entries about Sipho and Thandi's open slot request", () => {
    const sql = makeSeedSql(fixtures);
    const sipho = seedUuid("account", "acc-seller");
    const naledi = seedUuid("account", "acc-mentor");
    expect(columnsOf(sql, "public.mentor_notes")).toEqual([
      "id",
      "owner_id",
      "kind",
      "check_in_on",
      "text",
      "author_id",
      "author_name",
      "created_at",
    ]);
    expect(rowsOf(sql, "public.mentor_notes")).toEqual(
      sampleMentorNotes.map(
        (note) =>
          `('${seedUuid("mentor-note", note.id)}', '${sipho}', ${q(note.kind)}, ${note.checkInOn ? q(note.checkInOn) : "null"}, ${q(note.text)}, '${naledi}', 'Naledi', ${q(note.createdAt)})`,
      ),
    );
    expect(columnsOf(sql, "public.hub_bookings")).toEqual([
      "id",
      "post_id",
      "account_id",
      "help",
      "time",
      "status",
      "created_at",
      "answered_at",
      "answered_by",
    ]);
    expect(rowsOf(sql, "public.hub_bookings")).toEqual([
      `('${seedUuid("hub-booking", "bk-s1")}', 'h-007', '${seedUuid("account", "acc-student")}', ${q(sampleHubBookings[0].help)}, 'Any time after 13:30', 'open', '2026-10-13T10:15:00.000Z', null, null)`,
    ]);
  });

  it("refuses fixtures it can't seed faithfully", () => {
    const [post] = sampleHubPostRows;
    expect(() => makeSeedSql({ ...fixtures, hubPosts: [{ ...post, authorId: "acc-nobody" }] })).toThrow(/acc-nobody/);
    expect(() => makeSeedSql({ ...fixtures, hubPosts: [{ ...post, image: { src: "https://x.example/a.png", alt: "" } }] })).toThrow(
      /placeholder/,
    );
    const [booking] = sampleHubBookings;
    expect(() => makeSeedSql({ ...fixtures, hubBookings: [{ ...booking, postId: "h-999" }] })).toThrow(/h-999/);
    const [conversation] = sampleConversations;
    expect(() =>
      makeSeedSql({ ...fixtures, conversations: [{ ...conversation, requestId: "r-001", requestTitle: "x" }] }),
    ).toThrow(/offer/);
  });
});
