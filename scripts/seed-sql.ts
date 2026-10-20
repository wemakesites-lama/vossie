import { createHash } from "node:crypto";
import type { SampleAccount } from "../data/fixtures/accounts.ts";
import type {
  ConsentRow,
  ConversationRow,
  HubBookingRow,
  HubPostRow,
  ListingRow,
  MentorNoteRow,
  MessageRow,
  NotificationRow,
  PickupPointRow,
  RequestRow,
  SellerRow,
} from "../lib/data/rows.ts";
import type { Campus, Category } from "../lib/types.ts";

// supabase/seed.sql from the fixtures (supabase foundation plan, Task 11; plan decision 4): the same campuses,
// categories, pickup points, shops, listings, sample accounts and conversations as the sample store, so local Supabase
// and staging show what sample mode shows. Stages G to J add what the store seeds for them (supabase schema catch-up
// plan, Task 10): the seller profiles' mentor and first approval, the 16 Looking For requests, the Hub's 18 posts,
// Naledi's two notes and Thandi's open slot request (lib/data/store.ts, seedStore). scripts/make-seed.ts writes the file (pnpm db:seed); seed-sql.test.ts fails
// when the file is out of date. Pure: the fixtures come in as arguments, so Vitest and plain Node can both run it.
//
// Ids the database keeps as uuids (accounts, shops, pickup points, conversations, messages, notifications, mentor
// notes, slot requests) are made
// from the fixture's own id, so they're the same on every run and on every machine. Listing, request and Hub post ids
// stay as they are ("l-001", "r-001", "h-001"): their short-id columns take them.

export type SeedFixtures = {
  campuses: readonly Campus[];
  categories: readonly Category[];
  /** The store's rows (data/fixtures/staff.ts), with when each was retired. */
  pickupPoints: readonly PickupPointRow[];
  accounts: readonly SampleAccount[];
  consents: readonly ConsentRow[];
  /** Shop slug to the sample account that owns it. */
  shopOwners: ReadonlyMap<string, string>;
  shops: readonly SellerRow[];
  listings: readonly ListingRow[];
  conversations: readonly ConversationRow[];
  messages: readonly MessageRow[];
  notifications: readonly NotificationRow[];
  /** Stage H's Looking For requests (data/fixtures/request-rows.ts): no asker, the fixture's offers as seedOffers. */
  requests: readonly RequestRow[];
  /** Stage G's Hub posts, mentor notes and slot requests (data/fixtures/staff.ts). */
  hubPosts: readonly HubPostRow[];
  mentorNotes: readonly MentorNoteRow[];
  hubBookings: readonly HubBookingRow[];
};

/**
 * The domains that may sign in on local Supabase and staging (private.allowed_email_domains): Eduvos's, so the real
 * flows can be tried with an Eduvos mailbox, and the reserved test domain the sample accounts use. Production gets its
 * domains from an ops step, never from this seed, and never allows vossie.test.
 */
export const SEED_EMAIL_DOMAINS: readonly string[] = ["eduvos.com", "vossie.test"];

/** The reserved test domain of the seed's sample accounts (RFC 2606's .test: it can never be a real mailbox). */
export const SEED_ACCOUNT_DOMAIN = "vossie.test";

/**
 * A sample account's address in the seed: the fixture's own name on the test domain, so "student@eduvos.com" in sample
 * mode is "student@vossie.test" here. The fixtures stay as they are (sample mode uses them); seed accounts, admin and
 * mentor included, never look like someone's real Eduvos address.
 */
export function seedEmail(fixtureEmail: string): string {
  const at = fixtureEmail.lastIndexOf("@");
  if (at < 1) throw new Error(`Not an email address: ${fixtureEmail}`);
  return `${fixtureEmail.slice(0, at)}@${SEED_ACCOUNT_DOMAIN}`;
}

/** A fixed uuid for a fixture's id: the SHA-1 of the kind and the id, shaped as a version 5 uuid (RFC 9562). */
export function seedUuid(kind: string, id: string): string {
  const hex = createHash("sha1").update(`vossie-seed:${kind}:${id}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Value = string | number | boolean | null | readonly string[] | { json: unknown };

/** A SQL literal. Text with a line break or a backslash is an E'' string, so each row stays on one line. */
function literal(value: Value): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
    return String(value);
  }
  if (typeof value === "string") {
    if (/[\n\r\t\\]/.test(value)) {
      const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "''")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
      return `E'${escaped}'`;
    }
    return `'${value.replace(/'/g, "''")}'`;
  }
  if ("json" in value) return `${literal(JSON.stringify(value.json))}::jsonb`;
  return value.length === 0 ? "'{}'::text[]" : `array[${value.map(literal).join(", ")}]::text[]`;
}

/** One INSERT with a row per line. */
function insert(table: string, columns: readonly string[], rows: readonly (readonly Value[])[]): string {
  if (rows.length === 0) return `-- ${table}: none\n`;
  const lines = rows.map((row) => {
    if (row.length !== columns.length) throw new Error(`${table}: ${row.length} values for ${columns.length} columns`);
    return `  (${row.map(literal).join(", ")})`;
  });
  return `insert into ${table} (${columns.join(", ")}) values\n${lines.join(",\n")};\n`;
}

const PLACEHOLDER = /^\/placeholders\/[a-z0-9/-]+\.svg$/;

export function makeSeedSql(f: SeedFixtures): string {
  const accountId = (id: string) => seedUuid("account", id);
  const shopId = (slug: string) => seedUuid("shop", slug);
  const pointId = (id: string) => seedUuid("pickup-point", id);
  const conversationId = (id: string) => seedUuid("conversation", id);
  const knownAccount = (id: string) => {
    if (!f.accounts.some(({ account }) => account.id === id)) throw new Error(`Unknown sample account ${id}`);
    return accountId(id);
  };
  const knownShop = (slug: string) => {
    if (!f.shops.some((shop) => shop.slug === slug)) throw new Error(`Unknown sample shop ${slug}`);
    return shopId(slug);
  };
  const knownConversation = (id: string) => {
    if (!f.conversations.some((row) => row.id === id)) throw new Error(`Unknown sample conversation ${id}`);
    return conversationId(id);
  };
  /** The shop a sample account's seller profile points at: its storefront, or the shop it's waiting with. */
  const shopOfSeller = (accountIdInFixtures: string, sellerSlug: string | null) => {
    if (sellerSlug) return knownShop(sellerSlug);
    for (const [slug, owner] of f.shopOwners) if (owner === accountIdInFixtures) return knownShop(slug);
    return null;
  };
  const threadPath = (id: string) => `/messages/${knownConversation(id)}`;
  const knownHubPost = (id: string) => {
    if (!f.hubPosts.some((post) => post.id === id)) throw new Error(`Unknown sample Hub post ${id}`);
    return id;
  };
  /** The app's "all" is every campus, which the database keeps as null (schema catch-up plan decision 2). */
  const campusOrEvery = (slug: string) => (slug === "all" ? null : slug);

  const parts: string[] = [
    [
      "-- Sample data for local Supabase and staging, never production (supabase foundation plan, Task 11).",
      "-- Generated by scripts/make-seed.ts from data/fixtures/: don't edit it by hand. Run `pnpm db:seed` after changing a",
      "-- fixture; scripts/seed-sql.test.ts fails while this file is out of date.",
      "--",
      "-- The sample accounts sign in as name@vossie.test, a reserved test domain, never a real Eduvos address. This seed",
      "-- allows vossie.test and eduvos.com, for trying the flows locally and on staging. Production's allowed domains come",
      "-- from an ops step, never from this file, and vossie.test must never be allowed there.",
      "",
    ].join("\n"),
  ];

  parts.push("-- Who may sign in.");
  parts.push(insert("private.allowed_email_domains", ["domain"], SEED_EMAIL_DOMAINS.map((domain) => [domain])));

  parts.push("-- Reference data.");
  parts.push(
    insert(
      "public.campuses",
      ["slug", "name", "region", "sort", "is_online"],
      f.campuses.map((campus, i) => [campus.slug, campus.name, campus.region, i + 1, campus.slug === "online"]),
    ),
  );
  parts.push(
    insert(
      "public.categories",
      ["slug", "name", "sort"],
      f.categories.map((category, i) => [category.slug, category.name, i + 1]),
    ),
  );
  parts.push(
    insert(
      "public.pickup_points",
      ["id", "campus_slug", "name", "retired_at", "created_at"],
      f.pickupPoints.map((point) => [pointId(point.id), point.campusSlug, point.name, point.retiredAt, point.createdAt]),
    ),
  );

  // The sample accounts as Auth users on the test domain (seedEmail), confirmed, signing in by email code only (no
  // password), with the columns Supabase Auth reads as text set to "" rather than null.
  parts.push("-- The sample accounts: Auth users, their email identities, profiles and consents.");
  parts.push(
    insert(
      "auth.users",
      [
        "instance_id",
        "id",
        "aud",
        "role",
        "email",
        "encrypted_password",
        "email_confirmed_at",
        "confirmation_token",
        "recovery_token",
        "email_change_token_new",
        "email_change",
        "raw_app_meta_data",
        "raw_user_meta_data",
        "created_at",
        "updated_at",
      ],
      f.accounts.map(({ account }) => [
        "00000000-0000-0000-0000-000000000000",
        accountId(account.id),
        "authenticated",
        "authenticated",
        seedEmail(account.email),
        "",
        account.createdAt,
        "",
        "",
        "",
        "",
        { json: { provider: "email", providers: ["email"] } },
        { json: {} },
        account.createdAt,
        account.createdAt,
      ]),
    ),
  );
  parts.push(
    insert(
      "auth.identities",
      ["id", "user_id", "provider_id", "identity_data", "provider", "created_at", "updated_at"],
      f.accounts.map(({ account }) => {
        const id = accountId(account.id);
        return [
          seedUuid("identity", account.id),
          id,
          id,
          { json: { sub: id, email: seedEmail(account.email), email_verified: true, phone_verified: false } },
          "email",
          account.createdAt,
          account.createdAt,
        ];
      }),
    ),
  );
  parts.push(
    insert(
      "public.profiles",
      ["id", "first_name", "campus_slug", "roles", "created_at"],
      f.accounts.map(({ account }) => [
        accountId(account.id),
        account.firstName,
        account.campusSlug,
        account.roles,
        account.createdAt,
      ]),
    ),
  );
  parts.push(
    insert(
      "public.consents",
      ["id", "account_id", "version", "agreed_at"],
      f.consents.map((consent) => [
        seedUuid("consent", consent.id),
        knownAccount(consent.accountId),
        consent.version,
        consent.agreedAt,
      ]),
    ),
  );

  parts.push("-- Shops, their pickup points, and the sample sellers' profiles.");
  parts.push(
    insert(
      "public.shops",
      [
        "id",
        "slug",
        "owner_id",
        "name",
        "tagline",
        "category_slug",
        "campus_slug",
        "verified",
        "badge",
        "about",
        "since",
        "image_placeholder",
        "image_alt",
        "slug_changed",
        "created_at",
        "updated_at",
      ],
      f.shops.map((shop) => {
        if (shop.image && !PLACEHOLDER.test(shop.image.src)) throw new Error(`${shop.slug}: not a placeholder image`);
        return [
          shopId(shop.slug),
          shop.slug,
          shop.ownerId ? knownAccount(shop.ownerId) : null,
          shop.name,
          shop.tagline,
          shop.categorySlug,
          shop.campusSlug,
          shop.verified,
          shop.badge,
          shop.about,
          shop.since,
          shop.image?.src ?? null,
          shop.image?.alt ?? "",
          shop.slugChanged,
          shop.createdAt,
          shop.updatedAt,
        ];
      }),
    ),
  );
  parts.push(
    insert(
      "public.shop_pickup_points",
      ["shop_id", "pickup_point_id"],
      f.shops.flatMap((shop) => shop.pickupPointIds.map((id) => [shopId(shop.slug), pointId(id)])),
    ),
  );
  parts.push(
    insert(
      "public.seller_profiles",
      [
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
      ],
      f.accounts.flatMap(({ account, seller }) =>
        seller
          ? [
              [
                accountId(account.id),
                seller.status,
                shopOfSeller(account.id, seller.sellerSlug),
                seller.appliedAt,
                seller.declinedAt ?? null,
                seller.pausedBy ?? null,
                seller.sellerPausedToo ?? false,
                seller.staffReason ?? null,
                seller.mentorId ? knownAccount(seller.mentorId) : null,
                seller.approvedAt ?? null,
              ],
            ]
          : [],
      ),
    ),
  );

  parts.push("-- Listings and their photos (placeholders until sellers upload their own).");
  parts.push(
    insert(
      "public.listings",
      [
        "id",
        "shop_id",
        "state",
        "kind",
        "title",
        "category_slug",
        "condition",
        "price_zar",
        "price_is_from",
        "pay_mode",
        "swap_for",
        "description",
        "handover",
        "pickup_point_id",
        "campus_slug",
        "created_at",
        "first_published_at",
        "updated_at",
        "hidden_at",
        "hidden_reason",
      ],
      f.listings.map((listing) => [
        listing.id,
        knownShop(listing.sellerSlug),
        listing.state,
        listing.kind,
        listing.title,
        listing.categorySlug,
        listing.condition,
        listing.priceZar,
        listing.priceIsFrom,
        listing.payMode,
        listing.swapFor,
        listing.description,
        listing.handover,
        listing.pickupPointId ? pointId(listing.pickupPointId) : null,
        listing.campusSlug,
        listing.createdAt,
        listing.firstPublishedAt,
        listing.updatedAt,
        listing.hiddenAt ?? null,
        listing.hiddenReason ?? null,
      ]),
    ),
  );
  parts.push(
    insert(
      "public.listing_photos",
      ["listing_id", "placeholder_src", "position", "alt"],
      f.listings.flatMap((listing) =>
        listing.photos.map((photo, position) => {
          if (!PLACEHOLDER.test(photo.src)) throw new Error(`${listing.id}: not a placeholder photo`);
          return [listing.id, photo.src, position, photo.alt];
        }),
      ),
    ),
  );

  parts.push("-- The sample conversations, their messages and notifications.");
  parts.push(
    insert(
      "public.conversations",
      [
        "id",
        "listing_id",
        "listing_title",
        "shop_id",
        "buyer_id",
        "seller_gone",
        "status",
        "created_at",
        "last_message_at",
        "first_reply_at",
        "completed_at",
        "confirmed_at",
        "confirmed_by",
      ],
      f.conversations.map((row) => {
        // An offer thread needs a request with an asker; the sample requests have none (request-rows.ts).
        if (row.requestId) throw new Error(`${row.id}: the seed has no offer threads (sample requests have no asker)`);
        return [
          conversationId(row.id),
          row.listingId,
          row.listingTitle,
          knownShop(row.sellerSlug),
          row.buyerId ? knownAccount(row.buyerId) : null,
          row.sellerGone,
          row.status,
          row.createdAt,
          row.lastMessageAt,
          row.firstReplyAt,
          row.completedAt,
          row.confirmedAt,
          row.confirmedBy,
        ];
      }),
    ),
  );
  parts.push(
    insert(
      "public.messages",
      ["id", "conversation_id", "side", "body", "swap_offer", "sent_at", "read_at"],
      f.messages.map((row) => [
        seedUuid("message", row.id),
        knownConversation(row.conversationId),
        row.from,
        row.body,
        row.swapOffer,
        row.sentAt,
        row.readAt,
      ]),
    ),
  );
  parts.push(
    insert(
      "public.notifications",
      ["id", "account_id", "kind", "subject_id", "text", "href", "created_at", "read_at", "count"],
      f.notifications.map((row) => {
        if (row.href !== `/messages/${row.subjectId}`) throw new Error(`${row.id}: expected a link to its conversation`);
        return [
          seedUuid("notification", row.id),
          knownAccount(row.accountId),
          row.kind,
          knownConversation(row.subjectId),
          row.text,
          threadPath(row.subjectId),
          row.createdAt,
          row.readAt,
          row.count ?? null,
        ];
      }),
    ),
  );

  parts.push("-- Stages G to J: Looking For requests, the Hub's posts, a mentor's notes and a slot request.");
  parts.push(
    insert(
      "public.requests",
      [
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
      ],
      f.requests.map((row) => [
        row.id,
        row.askerId ? knownAccount(row.askerId) : null,
        row.title,
        row.categorySlug,
        row.campusSlug,
        row.details,
        row.budgetZar,
        row.swapWelcome,
        row.neededBy,
        row.status,
        row.createdAt,
        row.updatedAt,
        row.closedAt,
        row.seedOffers,
        row.hiddenAt,
        row.hiddenReason,
      ]),
    ),
  );
  parts.push(
    insert(
      "public.hub_posts",
      [
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
      ],
      f.hubPosts.map((post) => {
        // Seed posts keep placeholder art; a cover photo (cover_photo_id) is only ever a staff member's upload.
        if (!PLACEHOLDER.test(post.image.src)) throw new Error(`${post.id}: not a placeholder image`);
        return [
          post.id,
          post.kind,
          post.title,
          post.summary,
          post.place,
          post.body,
          campusOrEvery(post.campusSlug),
          post.startsAt,
          post.capacity,
          post.going,
          post.image.src,
          post.image.alt,
          post.published,
          post.publishedAt,
          post.authorId ? knownAccount(post.authorId) : null,
          post.createdAt,
          post.updatedAt,
        ];
      }),
    ),
  );
  parts.push(
    insert(
      "public.mentor_notes",
      ["id", "owner_id", "kind", "check_in_on", "text", "author_id", "author_name", "created_at"],
      f.mentorNotes.map((note) => [
        seedUuid("mentor-note", note.id),
        knownAccount(note.ownerId),
        note.kind,
        note.checkInOn,
        note.text,
        note.authorId ? knownAccount(note.authorId) : null,
        note.authorName,
        note.createdAt,
      ]),
    ),
  );
  parts.push(
    insert(
      "public.hub_bookings",
      ["id", "post_id", "account_id", "help", "time", "status", "created_at", "answered_at", "answered_by"],
      f.hubBookings.map((booking) => [
        seedUuid("hub-booking", booking.id),
        knownHubPost(booking.postId),
        knownAccount(booking.accountId),
        booking.help,
        booking.time,
        booking.status,
        booking.createdAt,
        booking.answeredAt,
        booking.answeredBy ? knownAccount(booking.answeredBy) : null,
      ]),
    ),
  );

  return parts.join("\n");
}
