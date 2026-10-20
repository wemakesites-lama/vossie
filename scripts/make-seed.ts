// Writes supabase/seed.sql from data/fixtures/ (supabase foundation plan, Task 11). Run from the project root:
//   pnpm db:seed   (node scripts/make-seed.ts: Node 26 runs TypeScript directly)
// Then `supabase db reset --local` loads it. scripts/seed-sql.test.ts fails while the file is out of date.

import { writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import type { SeedFixtures } from "./seed-sql.ts";

// A few fixtures import their neighbours without an extension ("./listings"), as the app's bundler allows. Plain Node
// needs one, so a relative import with none is tried as ".ts". Static imports are resolved before this runs, so the
// fixtures are loaded with import() below.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const [{ makeSeedSql }, { campuses }, { categories }, staff, { sampleRequestRows }, accounts, shops, messages] =
  await Promise.all([
    import("./seed-sql.ts"),
    import("../data/fixtures/campuses.ts"),
    import("../data/fixtures/categories.ts"),
    import("../data/fixtures/staff.ts"),
    import("../data/fixtures/request-rows.ts"),
    import("../data/fixtures/accounts.ts"),
    import("../data/fixtures/shops.ts"),
    import("../data/fixtures/messages.ts"),
  ]);

const fixtures: SeedFixtures = {
  campuses,
  categories,
  pickupPoints: staff.samplePickupPointRows,
  accounts: accounts.sampleAccounts,
  consents: accounts.sampleConsents,
  shopOwners: shops.sampleShopOwners,
  shops: shops.sampleSellerRows,
  listings: shops.sampleListingRows,
  conversations: messages.sampleConversations,
  messages: messages.sampleMessages,
  notifications: messages.sampleNotifications,
  requests: sampleRequestRows,
  hubPosts: staff.sampleHubPostRows,
  mentorNotes: staff.sampleMentorNotes,
  hubBookings: staff.sampleHubBookings,
};

writeFileSync("supabase/seed.sql", makeSeedSql(fixtures));
console.log("Wrote supabase/seed.sql");
