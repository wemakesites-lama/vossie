import { beforeEach, describe, expect, it } from "vitest";
import { clearFormState, getFormState, saveFormState } from "./form-states";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_10_MINUTES = "2026-10-14T08:52:00.000Z";

beforeEach(() => {
  resetSampleStore();
});

const details = (sessionKey: string) => ({
  sessionKey,
  form: "details",
  errors: ["first-name-length"],
  values: { firstName: "T" },
  notice: null,
  expiresAt: IN_10_MINUTES,
});

describe("form state (accounts plan decision 3)", () => {
  it("keeps one state per session and form, handing out a copy", async () => {
    await saveFormState(details("mine"), NOW);
    const found = await getFormState("mine", "details", NOW);
    expect(found).toMatchObject({ errors: ["first-name-length"], values: { firstName: "T" } });
    found!.errors.push("campus-missing");
    expect((await getFormState("mine", "details", NOW))?.errors).toEqual(["first-name-length"]);
    expect(await getFormState("other", "details", NOW)).toBeNull();
    expect(await getFormState("mine", "delete-account", NOW)).toBeNull();
  });

  it("forgets it after its time, and tidies it away on the next save", async () => {
    await saveFormState(details("mine"), NOW);
    expect(await getFormState("mine", "details", new Date(IN_10_MINUTES))).toBeNull();
    await saveFormState(details("other"), new Date("2026-10-14T09:00:00.000Z"));
    expect([...sampleStore().formStates.values()].map((row) => row.sessionKey)).toEqual(["other"]);
  });

  it("clears one form's state", async () => {
    await saveFormState(details("mine"), NOW);
    await clearFormState("mine", "details");
    expect(await getFormState("mine", "details", NOW)).toBeNull();
  });
});
