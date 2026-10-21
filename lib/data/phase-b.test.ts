import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeProfile,
  createAccount,
  getLatestConsent,
  getViewerAccount,
  hasProfile,
  recordConsent,
} from "./accounts";
import { clearSessionFormStates, getFormState, saveFormState, takeFormState } from "./form-states";
import { createSession, listSessions } from "./sessions";
import { getSignInAttempt, recordWrongTry, reserveCodeSend, reserveIpSend } from "./sign-in";
import { resetSampleStore, sampleStore } from "./store";

// Phase B's four lib/data modules (Task 4; amendments 4 and 10): the new exports' sample versions, and the switch lines
// that hand each function to its Supabase twin when VOSSIE_BACKEND says so, through import() only.

const twins = vi.hoisted(() => ({
  signIn: { getSignInAttempt: vi.fn(async () => null), recordWrongTry: vi.fn(async () => 2), reserveCodeSend: vi.fn(async () => true), reserveIpSend: vi.fn(async () => true) },
  sessions: { listSessions: vi.fn(async () => []), createSession: vi.fn(async () => {}) },
  formStates: {
    getFormState: vi.fn(async () => null),
    saveFormState: vi.fn(async () => {}),
    takeFormState: vi.fn(async () => null),
    clearSessionFormStates: vi.fn(async () => {}),
  },
  accounts: {
    getViewerAccount: vi.fn(async () => null),
    hasProfile: vi.fn(async () => true),
    completeProfile: vi.fn(async () => true),
    recordConsent: vi.fn(async () => {}),
    getLatestConsent: vi.fn(async () => null),
    createAccount: vi.fn(async () => {
      throw new Error("Supabase");
    }),
  },
}));
vi.mock("./supabase/sign-in", () => twins.signIn);
vi.mock("./supabase/sessions", () => twins.sessions);
vi.mock("./supabase/form-states", () => twins.formStates);
vi.mock("./supabase/accounts", () => twins.accounts);

const NOW = new Date("2026-10-21T10:00:00.000Z");
const CLAIMS = { userId: "acc-student", sessionId: "s", email: "student@eduvos.com" };

beforeEach(() => {
  resetSampleStore();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("the new exports' sample versions (amendment 10)", () => {
  it("getViewerAccount and hasProfile read the store", async () => {
    expect((await getViewerAccount(CLAIMS))?.firstName).toBe("Thandi");
    expect(await hasProfile("acc-student")).toBe(true);
    expect(await hasProfile("acc-nobody")).toBe(false);
  });

  it("completeProfile makes the account once, with consent", async () => {
    const details = { email: "new@eduvos.com", firstName: "Ayanda", campusSlug: "pretoria", policyVersion: "2026-10-draft", now: NOW };
    expect(await completeProfile(details)).toBe(true);
    expect(await completeProfile({ ...details, firstName: "Someone" })).toBe(false);
    const account = [...sampleStore().accounts.values()].find((row) => row.email === "new@eduvos.com")!;
    expect(account.firstName).toBe("Ayanda");
    expect(await getLatestConsent(account.id)).toEqual({ version: "2026-10-draft", agreedAt: NOW.toISOString() });
  });

  it("clearSessionFormStates clears that session's states and no other's", async () => {
    const state = { form: "details", errors: [], values: {}, notice: "saved", expiresAt: "2026-10-21T10:10:00.000Z" };
    await saveFormState({ ...state, sessionKey: "mine" }, NOW);
    await saveFormState({ ...state, sessionKey: "theirs" }, NOW);
    await clearSessionFormStates("mine");
    expect(await getFormState("mine", "details", NOW)).toBeNull();
    expect(await getFormState("theirs", "details", NOW)).not.toBeNull();
  });

  it("the sample path loads no Supabase twin", async () => {
    await getSignInAttempt("k", NOW);
    await listSessions("acc-student");
    await recordConsent("acc-student", "2026-10-draft", NOW);
    for (const twin of Object.values(twins)) for (const fn of Object.values(twin)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("the switch lines (C0's convention)", () => {
  beforeEach(() => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
  });

  it("hands sign-in's functions to the twin", async () => {
    await getSignInAttempt("k", NOW);
    expect(await recordWrongTry("k")).toBe(2);
    await reserveCodeSend("a@vossie.net", NOW, 5);
    expect(twins.signIn.getSignInAttempt).toHaveBeenCalledWith("k", NOW);
    expect(twins.signIn.reserveCodeSend).toHaveBeenCalledWith("a@vossie.net", NOW, 5);
    expect(await reserveIpSend("ip-key", NOW, 15)).toBe(true);
    expect(twins.signIn.reserveIpSend).toHaveBeenCalledWith("ip-key", NOW, 15);
  });

  it("refuses the network's count on the sample backend, which never asks for it (review fix 2)", async () => {
    vi.unstubAllEnvs();
    await expect(reserveIpSend("ip-key", NOW, 15)).rejects.toThrow("Supabase only");
    expect(twins.signIn.reserveIpSend).not.toHaveBeenCalled();
  });

  it("hands sessions', form states' and accounts' functions to their twins", async () => {
    await listSessions("u");
    await createSession({ key: "k", accountId: "u", createdAt: NOW, expiresAt: NOW });
    await getFormState("s", "f", NOW);
    await takeFormState("s", "f", NOW);
    await clearSessionFormStates("s");
    await getViewerAccount(CLAIMS);
    await hasProfile("u");
    await recordConsent("u", "v", NOW);
    await expect(createAccount({ email: "a@vossie.net", firstName: "A", campusSlug: "pretoria", now: NOW })).rejects.toThrow("Supabase");
    expect(twins.sessions.listSessions).toHaveBeenCalledWith("u");
    expect(twins.sessions.createSession).toHaveBeenCalledTimes(1);
    expect(twins.formStates.getFormState).toHaveBeenCalledWith("s", "f", NOW);
    expect(twins.formStates.takeFormState).toHaveBeenCalledTimes(1);
    expect(twins.formStates.clearSessionFormStates).toHaveBeenCalledWith("s");
    expect(twins.accounts.getViewerAccount).toHaveBeenCalledWith(CLAIMS);
    expect(twins.accounts.hasProfile).toHaveBeenCalledWith("u");
    expect(twins.accounts.recordConsent).toHaveBeenCalledWith("u", "v", NOW);
    expect(sampleStore().accounts.has("u")).toBe(false);
  });
});
