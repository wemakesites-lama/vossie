import { beforeEach, describe, expect, it } from "vitest";
import { saveFormState } from "./form-states";
import { createSession, deleteSession, findSessionAccountId, listSessions } from "./sessions";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("sessions (accounts spec 2.5)", () => {
  it("finds the account a session belongs to until it runs out", async () => {
    await createSession({ key: "key-1", accountId: "acc-student", createdAt: NOW, expiresAt: IN_30_DAYS });
    expect(await findSessionAccountId("key-1", NOW)).toBe("acc-student");
    expect(await findSessionAccountId("key-1", new Date("2026-11-13T08:41:59.000Z"))).toBe("acc-student");
    expect(await findSessionAccountId("key-1", IN_30_DAYS)).toBeNull();
    expect(await findSessionAccountId("key-2", NOW)).toBeNull();
  });

  it("lists an account's sessions, oldest first, and no one else's", async () => {
    const later = new Date("2026-10-15T08:00:00.000Z");
    await createSession({ key: "later", accountId: "acc-student", createdAt: later, expiresAt: IN_30_DAYS });
    await createSession({ key: "earlier", accountId: "acc-student", createdAt: NOW, expiresAt: IN_30_DAYS });
    await createSession({ key: "theirs", accountId: "acc-admin", createdAt: NOW, expiresAt: IN_30_DAYS });
    expect((await listSessions("acc-student")).map((row) => row.key)).toEqual(["earlier", "later"]);
  });

  it("tidies away sessions that have run out when another starts", async () => {
    await createSession({
      key: "old",
      accountId: "acc-student",
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
      expiresAt: new Date("2026-10-01T08:00:00.000Z"),
    });
    await createSession({ key: "new", accountId: "acc-student", createdAt: NOW, expiresAt: IN_30_DAYS });
    expect([...sampleStore().sessions.keys()]).toEqual(["new"]);
  });

  it("signs one browser out, and its forms' state goes with it", async () => {
    await createSession({ key: "mine", accountId: "acc-student", createdAt: NOW, expiresAt: IN_30_DAYS });
    await createSession({ key: "other", accountId: "acc-student", createdAt: NOW, expiresAt: IN_30_DAYS });
    const state = { form: "details", errors: [], values: {}, notice: "saved", expiresAt: IN_30_DAYS.toISOString() };
    await saveFormState({ sessionKey: "mine", ...state }, NOW);
    await saveFormState({ sessionKey: "other", ...state }, NOW);
    await deleteSession("mine");
    expect(await findSessionAccountId("mine", NOW)).toBeNull();
    expect(await findSessionAccountId("other", NOW)).toBe("acc-student");
    expect([...sampleStore().formStates.values()].map((row) => row.sessionKey)).toEqual(["other"]);
  });
});
