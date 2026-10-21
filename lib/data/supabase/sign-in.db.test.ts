import { afterEach, describe, expect, it } from "vitest";
import {
  deleteSignInAttempt,
  getSignInAttempt,
  recordWrongTry,
  reserveCodeSend,
  reserveIpSend,
  saveSignInAttempt,
} from "@/lib/data/sign-in";
import { makeSignInAttempt } from "@/tests/helpers/fakes";

// Sign-in attempts and the code count on the local stack (phase B, Task 4), through lib/data with VOSSIE_BACKEND=supabase
// (the global setup's), so the switch lines, the twin and the phase B migration's functions are all the real ones.

const KEY = "phase-b-db-attempt";
const EMAIL = `phase-b-sends-${Date.now()}@vossie.test`;

afterEach(async () => {
  await deleteSignInAttempt(KEY);
});

describe("attempts through the admin client (phase B decision 2)", () => {
  it("round-trip every field, with no code hash", async () => {
    const now = new Date();
    const attempt = makeSignInAttempt({
      key: KEY,
      step: "code",
      email: "thandi@vossie.net",
      errors: ["code-soon"],
      resent: true,
      codeHash: "never-stored",
      codeExpiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      wrongTries: 1,
      consentedAt: now.toISOString(),
      firstName: "Thandi",
      campusSlug: "pretoria",
      postedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
    });
    await saveSignInAttempt(attempt, now);
    expect(await getSignInAttempt(KEY, now)).toEqual({ ...attempt, codeHash: null });
    await deleteSignInAttempt(KEY);
    expect(await getSignInAttempt(KEY, now)).toBeNull();
  });

  it("count tries posted at once each in one statement: 1 and 2, never 1 twice", async () => {
    const now = new Date();
    await saveSignInAttempt(
      makeSignInAttempt({ key: KEY, step: "code", codeExpiresAt: new Date(now.getTime() + 600_000).toISOString(), expiresAt: new Date(now.getTime() + 1_800_000).toISOString() }),
      now,
    );
    const counts = await Promise.all([recordWrongTry(KEY), recordWrongTry(KEY)]);
    expect(counts.sort()).toEqual([1, 2]);
    // A late save carrying the first count doesn't put it back (amendment 2).
    await saveSignInAttempt({ ...(await getSignInAttempt(KEY, now))!, wrongTries: 1 }, now);
    expect((await getSignInAttempt(KEY, now))?.wrongTries).toBe(2);
    expect(await recordWrongTry("phase-b-no-such-attempt")).toBe(0);
  });
});

describe("the code count (spec 5)", () => {
  // The admin client can't reach private.code_sends: the hourly sweep takes this hour's row. The address is this run's.
  it("gives five codes an hour, then no", async () => {
    const now = new Date();
    const answers: boolean[] = [];
    for (let i = 0; i < 6; i += 1) answers.push(await reserveCodeSend(EMAIL, now, 5));
    expect(answers).toEqual([true, true, true, true, true, false]);
  });
});

describe("the network's count (review fix 2)", () => {
  // The key stands for an IP address's keyed hash; this run's own, so the hour's earlier runs don't count.
  it("gives one network 15 codes an hour, then no; another network has its own", async () => {
    const now = new Date();
    const key = `phase-b-ip-${Date.now()}`;
    const answers: boolean[] = [];
    for (let i = 0; i < 16; i += 1) answers.push(await reserveIpSend(key, now, 15));
    expect(answers).toEqual([...Array<boolean>(15).fill(true), false]);
    expect(await reserveIpSend(`${key}-other`, now, 15)).toBe(true);
  });
});
