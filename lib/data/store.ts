import { sampleAccounts, sampleConsents } from "@/data/fixtures/accounts";
import type {
  AccountRow,
  ConsentRow,
  FormStateRow,
  SampleEmailRow,
  SellerProfileRow,
  SessionRow,
  SignInAttemptRow,
} from "./rows";

/**
 * The sample store (accounts spec 2.1 and section 4), standing in for Supabase until there's a backend: one per server
 * process, seeded from the fixtures, gone when the server restarts. It lives on globalThis because each route, Server
 * Action and route handler may load this module separately, and they must all see the same data. Only lib/data reads
 * or writes it.
 *
 * Each table is a Map keyed by its primary key. To add one (stages E to G), follow the accounts plan's "Store design":
 * a row type in rows.ts, a field here, its seed in seedStore(), and a bump of STORE_VERSION.
 */
export type SampleStore = {
  version: number;
  /** By id. */
  accounts: Map<string, AccountRow>;
  /** By account id. */
  sellerProfiles: Map<string, SellerProfileRow>;
  /** By id. */
  consents: Map<string, ConsentRow>;
  /** By the SHA-256 of the session cookie's token. */
  sessions: Map<string, SessionRow>;
  /** By the SHA-256 of the sign-in cookie's token. */
  signInAttempts: Map<string, SignInAttemptRow>;
  /** Email → when codes were sent to it, for the limit of 5 an hour (spec 5). */
  codeSends: Map<string, string[]>;
  /** By attempt key: sample mode's outbox (spec 2.3). */
  sampleEmails: Map<string, SampleEmailRow>;
  /** By `${sessionKey}:${form}`. */
  formStates: Map<string, FormStateRow>;
};

/** Bump it when a table is added or a row changes shape, so `next dev` reseeds instead of keeping an old store. */
export const STORE_VERSION = 1;

type StoreHolder = { __vossieSampleStore?: SampleStore };

const holder = () => globalThis as unknown as StoreHolder;

/** The store, seeded on first use. */
export function sampleStore(): SampleStore {
  const current = holder().__vossieSampleStore;
  if (current?.version === STORE_VERSION) return current;
  const fresh = seedStore();
  holder().__vossieSampleStore = fresh;
  return fresh;
}

/** A fresh store from the fixtures. Unit tests call it before each test; the app never does. */
export function resetSampleStore(): void {
  holder().__vossieSampleStore = seedStore();
}

function seedStore(): SampleStore {
  // Copies, so a write to the store can never change the fixtures.
  const accounts = structuredClone(sampleAccounts);
  const consents = structuredClone(sampleConsents);
  return {
    version: STORE_VERSION,
    accounts: new Map(accounts.map(({ account }) => [account.id, account])),
    sellerProfiles: new Map(accounts.flatMap(({ seller }) => (seller ? [[seller.accountId, seller] as const] : []))),
    consents: new Map(consents.map((consent) => [consent.id, consent])),
    sessions: new Map(),
    signInAttempts: new Map(),
    codeSends: new Map(),
    sampleEmails: new Map(),
    formStates: new Map(),
  };
}
