import { afterEach, describe, expect, it, vi } from "vitest";
import { callsIn, calleeName, enclosingFunctionName, insideCallbackOf, parse, staffActionFiles } from "@/tests/helpers/action-sources";
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

// A source check (C4/C5 plan Task 12): every follow-up a staff action makes on the sample store sits inside a
// sampleFollowUps callback, so none runs twice on Supabase. Read with TypeScript's parser, not a regex. The helpers that
// are themselves follow-ups (tellOwner, tellReporter) are checked where they're called.
const FOLLOW_UPS = new Set([
  "recordAudit",
  "notify",
  "tellOwner",
  "tellReporter",
  "closeReportsOn",
  "closeReportsAboutShop",
  "attachPhotos",
  "deletePhotosUsedBy",
]);

describe("every staff action's follow-ups run inside sampleFollowUps (C4/C5 plan Task 12, decision 3)", () => {
  for (const path of staffActionFiles()) {
    it(path, () => {
      const file = parse(path);
      const outside = callsIn(file)
        .filter((call) => FOLLOW_UPS.has(calleeName(call) ?? ""))
        .filter((call) => !FOLLOW_UPS.has(enclosingFunctionName(call) ?? ""))
        .filter((call) => !insideCallbackOf(call, "sampleFollowUps"))
        .map((call) => `${calleeName(call)} at line ${file.getLineAndCharacterOfPosition(call.getStart()).line + 1}`);
      expect(outside).toEqual([]);
    });
  }

  it("finds the files and their follow-ups (the check isn't vacuous)", () => {
    expect(staffActionFiles()).toEqual(
      expect.arrayContaining(["lib/staff/admin-actions.ts", "lib/staff/hub-actions.ts", "lib/hub-actions.ts"]),
    );
    const wrapped = callsIn(parse("lib/staff/admin-actions.ts")).filter((call) => calleeName(call) === "recordAudit");
    expect(wrapped.length).toBeGreaterThan(10);
  });
});
