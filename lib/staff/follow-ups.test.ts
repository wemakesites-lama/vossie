import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleFollowUps } from "./follow-ups";

// A staff action's follow-ups run on the sample store only (C4/C5 plan decision 3): on Supabase the staff function
// wrote the audit row, closed the reports and sent the notifications in its own transaction.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sampleFollowUps (C4/C5 plan decision 3)", () => {
  it("runs the follow-ups once on the sample store, and waits for them", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "");
    const done: string[] = [];
    await sampleFollowUps(async () => {
      await Promise.resolve();
      done.push("audit");
    });
    expect(done).toEqual(["audit"]);
  });

  it("never on Supabase", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    const work = vi.fn(async () => {});
    await sampleFollowUps(work);
    expect(work).not.toHaveBeenCalled();
  });

  it("passes on what the follow-ups throw", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "sample");
    await expect(sampleFollowUps(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });
});
