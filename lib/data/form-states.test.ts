import { beforeEach, describe, expect, it } from "vitest";
import { clearFormState, getFormState, saveFormState, takeFormState } from "./form-states";
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

describe("taking a one-time state (selling plan amendment 14.1)", () => {
  it("lets the first caller take it, and shows every later caller what the first left", async () => {
    await saveFormState({ ...details("mine"), errors: [], values: {} }, NOW);
    const first = await takeFormState("mine", "details", NOW);
    expect(first).toMatchObject({ first: true, state: { taken: true } });
    // The first leaves its answer by saving the state again, kept as taken.
    await saveFormState({ ...details("mine"), errors: [], values: { path: "/sell/listings" }, taken: true }, NOW);
    const later = await takeFormState("mine", "details", NOW);
    expect(later).toMatchObject({ first: false, state: { taken: true, values: { path: "/sell/listings" } } });
    // A state saved the ordinary way was never taken.
    await saveFormState(details("mine"), NOW);
    expect((await getFormState("mine", "details", NOW))?.taken).toBeUndefined();
  });

  it("is one step: of two takes started together, only one is first", async () => {
    await saveFormState(details("mine"), NOW);
    const takes = await Promise.all([1, 2, 3].map(() => takeFormState("mine", "details", NOW)));
    expect(takes.filter((taken) => taken?.first)).toHaveLength(1);
    expect(takes.filter((taken) => taken && !taken.first)).toHaveLength(2);
  });

  it("finds nothing for a state that was never made, belongs to another session, or has run out", async () => {
    await saveFormState(details("mine"), NOW);
    expect(await takeFormState("mine", "other-form", NOW)).toBeNull();
    expect(await takeFormState("other", "details", NOW)).toBeNull();
    expect(await takeFormState("mine", "details", new Date(IN_10_MINUTES))).toBeNull();
    // None of those took it.
    expect(await takeFormState("mine", "details", NOW)).toMatchObject({ first: true });
  });

  it("hands out a copy", async () => {
    await saveFormState(details("mine"), NOW);
    const taken = await takeFormState("mine", "details", NOW);
    taken!.state.values.firstName = "changed";
    expect((await getFormState("mine", "details", NOW))?.values.firstName).toBe("T");
  });
});
