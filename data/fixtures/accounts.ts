import type { AccountRow, ConsentRow, SellerProfileRow } from "@/lib/data/rows";

// The sample accounts (accounts spec 2.8): one for each role, all at eduvos.com, the default sign-in domain. Fixtures
// import nothing at run time (scripts/make-placeholders.ts runs fixture files in plain Node). The names are samples
// for Lama to change (accounts plan decision 15).

export type SampleAccount = {
  /** What its button says on the sign-in page. */
  label: string;
  account: AccountRow;
  seller: SellerProfileRow | null;
};

export const sampleAccounts: readonly SampleAccount[] = [
  {
    label: "Student, Midrand",
    account: {
      id: "acc-student",
      email: "student@eduvos.com",
      firstName: "Thandi",
      campusSlug: "midrand",
      roles: [],
      createdAt: "2026-09-01T07:30:00.000Z",
    },
    seller: null,
  },
  {
    label: "Seller, Tech corner",
    account: {
      id: "acc-seller",
      email: "seller@eduvos.com",
      firstName: "Sipho",
      campusSlug: "midrand",
      roles: [],
      createdAt: "2026-03-02T09:15:00.000Z",
    },
    seller: { accountId: "acc-seller", status: "approved", sellerSlug: "tech-corner", appliedAt: "2026-03-02T09:40:00.000Z" },
  },
  {
    label: "Seller waiting for approval",
    account: {
      id: "acc-pending",
      email: "pending@eduvos.com",
      firstName: "Lerato",
      campusSlug: "pretoria",
      roles: [],
      createdAt: "2026-10-10T12:05:00.000Z",
    },
    seller: { accountId: "acc-pending", status: "pending", sellerSlug: null, appliedAt: "2026-10-10T12:20:00.000Z" },
  },
  {
    label: "Mentor",
    account: {
      id: "acc-mentor",
      email: "mentor@eduvos.com",
      firstName: "Naledi",
      campusSlug: "midrand",
      roles: ["mentor"],
      createdAt: "2026-02-16T08:00:00.000Z",
    },
    seller: null,
  },
  {
    label: "Admin",
    account: {
      id: "acc-admin",
      email: "admin@eduvos.com",
      firstName: "Pieter",
      campusSlug: "pretoria",
      roles: ["admin"],
      createdAt: "2026-02-02T08:00:00.000Z",
    },
    seller: null,
  },
];

/**
 * Each sample account agreed to this draft of the privacy policy (accounts spec 2.7). The version repeats
 * POLICY_VERSION in lib/auth/config.ts, which a fixture can't import; a test there checks the two agree.
 */
export const sampleConsents: readonly ConsentRow[] = sampleAccounts.map(({ account }) => ({
  id: `consent-${account.id}`,
  accountId: account.id,
  version: "2026-10-draft",
  agreedAt: "2026-10-14T08:00:00.000Z",
}));
