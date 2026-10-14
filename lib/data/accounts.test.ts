import { beforeEach, describe, expect, it } from "vitest";
import { makeSignInAttempt } from "@/tests/helpers/fakes";
import {
  createAccount,
  deleteAccountData,
  exportAccountData,
  findAccountByEmail,
  getAccount,
  getAccountActivity,
  getLatestConsent,
  getSampleSignIns,
  recordConsent,
  restoreSampleAccount,
  updateAccountDetails,
} from "./accounts";
import { saveFormState } from "./form-states";
import { createSession } from "./sessions";
import { recordCodeSent, saveSampleEmail, saveSignInAttempt } from "./sign-in";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("accounts (accounts spec 2.6 and 2.9)", () => {
  it("finds an account by id or by email, with its shop and roles", async () => {
    expect(await findAccountByEmail("seller@eduvos.com")).toEqual({
      id: "acc-seller",
      email: "seller@eduvos.com",
      firstName: "Sipho",
      campusSlug: "midrand",
      roles: [],
      seller: { status: "approved", sellerSlug: "tech-corner" },
      createdAt: "2026-03-02T09:15:00.000Z",
    });
    expect((await getAccount("acc-mentor"))?.roles).toEqual(["mentor"]);
    expect((await getAccount("acc-pending"))?.seller).toEqual({ status: "pending", sellerSlug: null });
    expect(await findAccountByEmail("nobody@eduvos.com")).toBeNull();
    expect(await getAccount("acc-nope")).toBeNull();
  });

  it("hands out copies, so changing one never changes the store", async () => {
    const account = (await getAccount("acc-student"))!;
    (account.roles as string[]).push("admin");
    expect((await getAccount("acc-student"))!.roles).toEqual([]);
  });

  it("creates a student account with a random id, no roles and no shop", async () => {
    const account = await createAccount({ email: "new@eduvos.com", firstName: "Ayanda", campusSlug: "pretoria", now: NOW });
    expect(account).toMatchObject({
      email: "new@eduvos.com",
      firstName: "Ayanda",
      campusSlug: "pretoria",
      roles: [],
      seller: null,
      createdAt: NOW.toISOString(),
    });
    expect(account.id).toMatch(/^acc-[0-9a-f-]{36}$/);
    expect(await findAccountByEmail("new@eduvos.com")).toEqual(account);
  });

  it("never makes a second account for an email: it gives back the one that's there, unchanged", async () => {
    const first = await createAccount({ email: "new@eduvos.com", firstName: "Ayanda", campusSlug: "pretoria", now: NOW });
    const again = await createAccount({
      email: "new@eduvos.com",
      firstName: "Zola",
      campusSlug: "midrand",
      now: new Date("2026-10-15T08:00:00.000Z"),
    });
    expect(again).toEqual(first);
    expect(await getAccount(first.id)).toMatchObject({ firstName: "Ayanda", campusSlug: "pretoria" });
    expect([...sampleStore().accounts.values()].filter((row) => row.email === "new@eduvos.com")).toHaveLength(1);
  });

  it("makes one account when two posts for the same new email overlap", async () => {
    const [a, b] = await Promise.all([
      createAccount({ email: "new@eduvos.com", firstName: "Ayanda", campusSlug: "pretoria", now: NOW }),
      createAccount({ email: "new@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW }),
    ]);
    expect(b.id).toBe(a.id);
    expect([...sampleStore().accounts.values()].filter((row) => row.email === "new@eduvos.com")).toHaveLength(1);
  });

  it("gives back a sample account rather than making a second one with its email", async () => {
    const existing = await createAccount({ email: "student@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    expect(existing).toMatchObject({ id: "acc-student", firstName: "Thandi" });
    expect(sampleStore().accounts.size).toBe(5);
  });

  it("changes the first name and campus", async () => {
    expect(await updateAccountDetails("acc-student", { firstName: "Thandiwe", campusSlug: "pretoria" })).toMatchObject({
      firstName: "Thandiwe",
      campusSlug: "pretoria",
    });
    expect(await getAccount("acc-student")).toMatchObject({ firstName: "Thandiwe", campusSlug: "pretoria" });
    expect(await updateAccountDetails("acc-nope", { firstName: "Zola", campusSlug: "pretoria" })).toBeNull();
  });

  it("has no activity for the context strip yet: zeros until messaging and selling (spec 2.9)", async () => {
    expect(await getAccountActivity("acc-student")).toEqual({ newMessages: 0, salesToConfirm: 0, savedItemsBack: 0 });
    expect(await getAccountActivity("acc-nope")).toBeNull();
  });

  it("lists the sample accounts' buttons (spec 2.8)", async () => {
    expect(await getSampleSignIns()).toEqual([
      { email: "student@eduvos.com", label: "Student, Midrand" },
      { email: "seller@eduvos.com", label: "Seller, Tech corner" },
      { email: "pending@eduvos.com", label: "Seller waiting for approval" },
      { email: "mentor@eduvos.com", label: "Mentor" },
      { email: "admin@eduvos.com", label: "Admin" },
    ]);
  });
});

describe("consent (accounts spec 2.7)", () => {
  it("records consent once per policy version, and shows the newest", async () => {
    const account = await createAccount({ email: "new@eduvos.com", firstName: "Ayanda", campusSlug: "pretoria", now: NOW });
    expect(await getLatestConsent(account.id)).toBeNull();
    await recordConsent(account.id, "2026-10-draft", NOW);
    await recordConsent(account.id, "2026-10-draft", new Date("2026-10-20T10:00:00.000Z"));
    expect(await getLatestConsent(account.id)).toEqual({ version: "2026-10-draft", agreedAt: NOW.toISOString() });
    await recordConsent(account.id, "2027-01", new Date("2027-01-05T09:00:00.000Z"));
    expect(await getLatestConsent(account.id)).toEqual({ version: "2027-01", agreedAt: "2027-01-05T09:00:00.000Z" });
  });

  it("has the sample accounts' seeded consent", async () => {
    expect(await getLatestConsent("acc-student")).toEqual({
      version: "2026-10-draft",
      agreedAt: "2026-10-14T08:00:00.000Z",
    });
  });
});

describe("the data export (accounts spec 3.3, plan decision 20)", () => {
  it("holds the account, its consent, and when its sessions started and end, with no ids", async () => {
    await createSession({ key: "session-key-1", accountId: "acc-seller", createdAt: NOW, expiresAt: IN_30_DAYS });
    const data = await exportAccountData("acc-seller", NOW);
    expect(data).toEqual({
      exportedAt: NOW.toISOString(),
      account: {
        email: "seller@eduvos.com",
        firstName: "Sipho",
        campus: "midrand",
        roles: [],
        memberSince: "2026-03-02T09:15:00.000Z",
        shop: { status: "approved", storefront: "tech-corner" },
      },
      consents: [{ policy: "2026-10-draft", agreedAt: "2026-10-14T08:00:00.000Z" }],
      sessions: [{ signedInAt: NOW.toISOString(), expiresAt: IN_30_DAYS.toISOString() }],
    });
    const text = JSON.stringify(data);
    expect(text).not.toContain("session-key-1");
    expect(text).not.toContain("acc-seller");
  });

  it("has nothing for an account that doesn't exist", async () => {
    expect(await exportAccountData("acc-nope", NOW)).toBeNull();
  });
});

describe("deleting an account (accounts spec 2.13)", () => {
  it("removes the account and everything that hangs off it, and nothing of anyone else's", async () => {
    await createSession({ key: "mine", accountId: "acc-pending", createdAt: NOW, expiresAt: IN_30_DAYS });
    await createSession({ key: "theirs", accountId: "acc-student", createdAt: NOW, expiresAt: IN_30_DAYS });
    await saveFormState(
      { sessionKey: "mine", form: "details", errors: ["first-name-missing"], values: {}, notice: null, expiresAt: IN_30_DAYS.toISOString() },
      NOW,
    );
    await saveSignInAttempt(makeSignInAttempt({ key: "attempt", email: "pending@eduvos.com", step: "code" }), NOW);
    await saveSampleEmail({ attemptKey: "attempt", to: "pending@eduvos.com", code: "111111", sentAt: NOW.toISOString() });
    await recordCodeSent("pending@eduvos.com", NOW);

    await deleteAccountData("acc-pending");

    const store = sampleStore();
    expect(store.accounts.has("acc-pending")).toBe(false);
    expect(store.sellerProfiles.has("acc-pending")).toBe(false);
    expect([...store.consents.values()].some((row) => row.accountId === "acc-pending")).toBe(false);
    expect([...store.sessions.keys()]).toEqual(["theirs"]);
    expect(store.formStates.size).toBe(0);
    expect(store.signInAttempts.has("attempt")).toBe(false);
    expect(store.sampleEmails.has("attempt")).toBe(false);
    expect(store.codeSends.has("pending@eduvos.com")).toBe(false);
    expect(store.accounts.size).toBe(4);
    expect(store.consents.size).toBe(4);
  });

  it("clears the sample outbox by address, even for an attempt that has already gone", async () => {
    // An outbox row whose attempt was ended some other way (a cancelled or tidied one) still holds the code and address.
    await saveSampleEmail({ attemptKey: "orphan", to: "pending@eduvos.com", code: "222222", sentAt: NOW.toISOString() });
    await saveSampleEmail({ attemptKey: "orphan-2", to: "pending@eduvos.com", code: "333333", sentAt: NOW.toISOString() });

    await deleteAccountData("acc-pending");

    expect(sampleStore().sampleEmails.size).toBe(0);
  });

  it("leaves another email's sign-in, outbox row and code count alone", async () => {
    await saveSignInAttempt(makeSignInAttempt({ key: "mine", email: "pending@eduvos.com", step: "code" }), NOW);
    await saveSampleEmail({ attemptKey: "mine", to: "pending@eduvos.com", code: "111111", sentAt: NOW.toISOString() });
    await saveSampleEmail({ attemptKey: "orphan", to: "pending@eduvos.com", code: "222222", sentAt: NOW.toISOString() });
    await recordCodeSent("pending@eduvos.com", NOW);
    await saveSignInAttempt(makeSignInAttempt({ key: "theirs", email: "student@eduvos.com", step: "code" }), NOW);
    await saveSampleEmail({ attemptKey: "theirs", to: "student@eduvos.com", code: "444444", sentAt: NOW.toISOString() });
    await saveSampleEmail({ attemptKey: "theirs-orphan", to: "student@eduvos.com", code: "555555", sentAt: NOW.toISOString() });
    await recordCodeSent("student@eduvos.com", NOW);

    await deleteAccountData("acc-pending");

    const store = sampleStore();
    expect([...store.signInAttempts.keys()]).toEqual(["theirs"]);
    expect([...store.sampleEmails.keys()].sort()).toEqual(["theirs", "theirs-orphan"]);
    expect([...store.codeSends.keys()]).toEqual(["student@eduvos.com"]);
  });
});

describe("sample accounts come back (plan decision 15)", () => {
  it("puts a deleted sample account back from the fixtures, with its shop and consent", async () => {
    await deleteAccountData("acc-seller");
    expect(await restoreSampleAccount("seller@eduvos.com")).toMatchObject({
      id: "acc-seller",
      firstName: "Sipho",
      seller: { status: "approved", sellerSlug: "tech-corner" },
    });
    expect(await getLatestConsent("acc-seller")).not.toBeNull();
  });

  it("leaves a sample account that's still there as it is", async () => {
    await updateAccountDetails("acc-student", { firstName: "Thandiwe", campusSlug: "midrand" });
    expect((await restoreSampleAccount("student@eduvos.com"))?.firstName).toBe("Thandiwe");
  });

  it("never makes a second account with a sample address", async () => {
    await deleteAccountData("acc-student");
    const own = await createAccount({ email: "student@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    expect((await restoreSampleAccount("student@eduvos.com"))?.id).toBe(own.id);
    expect([...sampleStore().accounts.values()].filter((row) => row.email === "student@eduvos.com")).toHaveLength(1);
  });

  it("is only for the sample addresses", async () => {
    expect(await restoreSampleAccount("someone@eduvos.com")).toBeNull();
  });
});
