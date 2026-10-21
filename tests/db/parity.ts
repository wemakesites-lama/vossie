import { vi } from "vitest";
import { sampleAccounts } from "@/data/fixtures/accounts";
import { sampleHubBookings, sampleMentorNotes, samplePickupPointRows } from "@/data/fixtures/staff";
import { resetSampleStore } from "@/lib/data/store";
import { seedUuid } from "@/scripts/seed-sql";

// Parity (2b plan decision 18, Task 13): the seed is generated from the same fixtures as the sample store, so on a
// freshly reset stack a public reader gives the same answer in both backends, once the ids that differ are mapped.
// This works because onSupabase() (lib/backend.ts) reads VOSSIE_BACKEND on each call.

/** Runs `read` on the sample store (fresh) and then on Supabase, and returns both answers as they came. */
export async function parity<T>(read: () => Promise<T>): Promise<{ sample: T; supabase: T }> {
  const before = process.env.VOSSIE_BACKEND;
  try {
    vi.stubEnv("VOSSIE_BACKEND", "sample");
    resetSampleStore();
    const sample = await read();
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    const supabase = await read();
    return { sample, supabase };
  } finally {
    // Back to what it was (the global setup's supabase), leaving any other stub the test made alone.
    vi.stubEnv("VOSSIE_BACKEND", before);
  }
}

/** The sample store's pickup point ids, to the uuids the seed and the reference migration give them. */
const POINT_IDS = new Map(samplePickupPointRows.map((row) => [row.id, seedUuid("pickup-point", row.id)]));

/** The sample store's account ids, to the uuids the seed gives them (C4/C5 plan decision 15). */
const ACCOUNT_IDS = new Map(sampleAccounts.map(({ account }) => [account.id, seedUuid("account", account.id)]));

/** The sample's slot requests and mentors' notes, to the seed's uuids (C4/C5 plan Tasks 18 and 19). */
const STAFF_TOOL_IDS = new Map([
  ...sampleHubBookings.map((row) => [row.id, seedUuid("hub-booking", row.id)] as const),
  ...sampleMentorNotes.map((row) => [row.id, seedUuid("mentor-note", row.id)] as const),
]);

/** The contract accounts' ids in both worlds: the sample world's acc-contract-<name>, and any uuid not in the seed. */
const isContractAccount = (id: string) =>
  id.startsWith("acc-contract-") || (/^[0-9a-f-]{36}$/.test(id) && ![...ACCOUNT_IDS.values()].includes(id));

/**
 * A staff list's answer without the contract tests' own accounts (C4/C5 plan decision 15): the world's accounts exist in
 * one backend and not the other. `idOf` gives each item's account id.
 */
export function dropContractAccounts<T>(list: readonly T[], idOf: (item: T) => string): T[] {
  return list.filter((item) => !isContractAccount(idOf(item)));
}

/** An ISO-8601 time with a zone: the fixtures write "…:00Z", the app and iso() "….000Z" (amendment 11). */
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function normaliseString(value: string): string {
  const point = POINT_IDS.get(value) ?? ACCOUNT_IDS.get(value) ?? STAFF_TOOL_IDS.get(value);
  if (point) return point;
  return TIME.test(value) ? new Date(value).toISOString() : value;
}

/**
 * A reader's answer with the differences that aren't differences taken out, for either backend: the sample's pickup
 * point, account, slot request and mentor's note ids become their uuids, and every time is written as toISOString()
 * writes it. Dates (YYYY-MM-DD) and everything else stay as they are. Arrays, Maps, Sets and plain objects are walked (object keys too).
 */
export function normalise<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return normaliseString(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [walk(key), walk(item)]));
  if (value instanceof Set) return new Set([...value].map(walk));
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [normaliseString(key), walk(item)]));
  }
  return value;
}
