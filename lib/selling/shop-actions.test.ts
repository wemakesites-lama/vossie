import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { getPhoto, photoIdOf } from "@/lib/data/photos";
import { createSession } from "@/lib/data/sessions";
import { emptyDraft, getOnboardingDraft, getShopOf, saveOnboardingDraft } from "@/lib/data/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { ascii, containsText, GPS, pngBytes } from "@/tests/helpers/image-bytes";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { DASHBOARD_FORM, onboardingForm, PROFILE_FORM } from "./form-state";
import { pauseShop, resumeShop, saveOnboardingStep, saveShopProfile, sendForApproval } from "./shop-actions";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

function form(fields: Record<string, string | string[] | File>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

/** A stored session for `accountId`, and its token in the browser's cookie. */
async function signedInAs(accountId: string) {
  await createSession({ key: hashToken("token-1"), accountId, createdAt: NOW, expiresAt: IN_30_DAYS });
  request.cookies.set(SESSION_COOKIE, "token-1");
}

const photoFile = (bytes: Uint8Array<ArrayBuffer>, name = "shop.png") => new File([bytes], name, { type: "image/png" });

const finishedDraft = () => ({
  ...emptyDraft("acc-student", "midrand", NOW),
  name: "Zola's Bakes",
  categorySlug: "food",
  about: "I bake between lectures.",
  pickupPointIds: ["pp-midrand-library"],
});

describe("the onboarding wizard (selling spec 2.6, plan decision 15)", () => {
  it("saves step 1 into the draft, tidied, and goes on to step 2", async () => {
    await signedInAs("acc-student");
    const redirect = await redirectSignalOf(() =>
      saveOnboardingStep(form({ step: "1", name: " Zola's   Bakes ", tagline: "Muffins on Mondays.", category: "food" })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sell/onboarding?step=2", "replace", true]);
    expect(await getOnboardingDraft("acc-student")).toMatchObject({
      name: "Zola's Bakes",
      tagline: "Muffins on Mondays.",
      categorySlug: "food",
      campusSlug: "midrand",
    });
  });

  it("keeps what was typed, with the errors, and stays on the step", async () => {
    await signedInAs("acc-student");
    expect(await redirectOf(() => saveOnboardingStep(form({ step: "1", name: "Z", category: "cars" })))).toBe(
      "/sell/onboarding",
    );
    expect((await getOnboardingDraft("acc-student"))?.name).toBe("Z");
    expect((await readFormState(onboardingForm(1)))?.errors).toEqual(["name-length", "category-missing"]);
  });

  it("refuses a name another shop on the same campus has, however it's written", async () => {
    await signedInAs("acc-student");
    await redirectOf(() => saveOnboardingStep(form({ step: "1", name: "TECH corner", category: "tech" })));
    expect((await readFormState(onboardingForm(1)))?.errors).toEqual(["name-taken"]);
  });

  it("refuses a name with no letter or digit in it (amendment 8.6)", async () => {
    await signedInAs("acc-student");
    await redirectOf(() => saveOnboardingStep(form({ step: "1", name: "🙂🙂", category: "food" })));
    expect((await readFormState(onboardingForm(1)))?.errors).toEqual(["name-missing"]);
  });

  it("stores a shop photo stripped of its location, and keeps it when step 3 is sent again with no file", async () => {
    await signedInAs("acc-student");
    const withPhoto = form({ step: "3", photo: photoFile(pngBytes({ exif: true, text: true })) });
    expect(await redirectOf(() => saveOnboardingStep(withPhoto))).toBe("/sell/onboarding?step=4");
    const src = (await getOnboardingDraft("acc-student"))!.photoSrc!;
    const stored = await getPhoto(photoIdOf(src)!, NOW);
    expect(stored?.type).toBe("image/png");
    expect(containsText(stored!.bytes, GPS)).toBe(false);
    expect(await redirectOf(() => saveOnboardingStep(form({ step: "3" })))).toBe("/sell/onboarding?step=4");
    expect((await getOnboardingDraft("acc-student"))?.photoSrc).toBe(src);
  });

  it("refuses a file that isn't a photo, by what's in it, and removes a photo when asked", async () => {
    await signedInAs("acc-student");
    const fake = form({ step: "3", photo: photoFile(ascii("GIF89a"), "cat.png") });
    expect(await redirectOf(() => saveOnboardingStep(fake))).toBe("/sell/onboarding?step=3");
    expect((await readFormState(onboardingForm(3)))?.errors).toEqual(["photo-type"]);
    await redirectOf(() => saveOnboardingStep(form({ step: "3", photo: photoFile(pngBytes()) })));
    const remove = form({ step: "3", photoAction: "remove" });
    expect(await redirectOf(() => saveOnboardingStep(remove))).toBe("/sell/onboarding?step=3");
    expect((await getOnboardingDraft("acc-student"))?.photoSrc).toBeNull();
    expect(sampleStore().photos.size).toBe(0);
  });

  it("asks for spots on the campus it showed, and comes back with another campus's spots", async () => {
    await signedInAs("acc-student");
    const step4 = (fields: Record<string, string | string[]>) =>
      redirectOf(() => saveOnboardingStep(form({ step: "4", ...fields })));
    expect(await step4({ campus: "midrand", pointsCampus: "midrand", pickupPoint: "pp-midrand-library" })).toBe(
      "/sell/onboarding?step=5",
    );
    expect(await getOnboardingDraft("acc-student")).toMatchObject({
      campusSlug: "midrand",
      pickupPointIds: ["pp-midrand-library"],
    });
    expect(await step4({ campus: "pretoria", pointsCampus: "midrand", pickupPoint: "pp-midrand-library" })).toBe(
      "/sell/onboarding?step=4",
    );
    expect(await getOnboardingDraft("acc-student")).toMatchObject({ campusSlug: "pretoria", pickupPointIds: [] });
    expect((await readFormState(onboardingForm(4)))?.errors).toEqual(["points-campus"]);
    expect(await step4({ campus: "pretoria", pointsCampus: "pretoria" })).toBe("/sell/onboarding?step=4");
    expect((await readFormState(onboardingForm(4)))?.errors).toEqual(["points-missing"]);
    // Eduvos Online has no pickup points to choose.
    expect(await step4({ campus: "online", pointsCampus: "pretoria" })).toBe("/sell/onboarding?step=5");
  });

  it("sends a finished draft for approval: the shop waits for the Hub, and the seller lands on /sell", async () => {
    await signedInAs("acc-student");
    await saveOnboardingDraft(finishedDraft());
    const redirect = await redirectSignalOf(() => sendForApproval(form({ guidelines: "yes" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sell", "replace", true]);
    expect(await getShopOf("acc-student")).toMatchObject({
      status: "pending",
      shop: { slug: "zolas-bakes", name: "Zola's Bakes" },
    });
    expect(request.updatedTags).toEqual(["sellers"]);
    expect(await getOnboardingDraft("acc-student")).toBeNull();
  });

  it("sends a draft with problems back to its first step, and asks for the guidelines box", async () => {
    await signedInAs("acc-student");
    await saveOnboardingDraft({ ...finishedDraft(), about: "", pickupPointIds: [] });
    expect(await redirectOf(() => sendForApproval(form({ guidelines: "yes" })))).toBe("/sell/onboarding?step=2");
    expect((await readFormState(onboardingForm(2)))?.errors).toEqual(["about-missing"]);
    expect((await readFormState(onboardingForm(4)))?.errors).toEqual(["points-missing"]);
    await saveOnboardingDraft(finishedDraft());
    expect(await redirectOf(() => sendForApproval(form({})))).toBe("/sell/onboarding?step=5");
    expect((await readFormState(onboardingForm(5)))?.errors).toEqual(["guidelines-missing"]);
    expect(await getShopOf("acc-student")).toBeNull();
  });

  it("stays on step 5 and says so when the shop can't be made, rather than landing on /sell with no shop (amendment 9.3)", async () => {
    await signedInAs("acc-student");
    await saveOnboardingDraft(finishedDraft());
    // A seller profile with no shop behind it: createShop refuses an account that has one.
    sampleStore().sellerProfiles.set("acc-student", {
      accountId: "acc-student",
      status: "pending",
      sellerSlug: null,
      appliedAt: NOW.toISOString(),
    });
    const redirect = await redirectSignalOf(() => sendForApproval(form({ guidelines: "yes" })));
    expect([redirect.url, redirect.type]).toEqual(["/sell/onboarding?step=5", "replace"]);
    expect((await readFormState(onboardingForm(5)))?.errors).toEqual(["send-failed"]);
    expect(await getShopOf("acc-student")).toBeNull();
    expect((await getOnboardingDraft("acc-student"))?.name).toBe("Zola's Bakes");
    // Nothing changed for buyers, so no tag expires.
    expect(request.updatedTags).toEqual([]);
  });

  it("sends anyone with a shop to /sell, and anyone signed out to sign in first", async () => {
    expect(await redirectOf(() => saveOnboardingStep(form({ step: "2", about: "Hi" })))).toBe(
      "/login?next=%2Fsell%2Fonboarding%3Fstep%3D2",
    );
    await signedInAs("acc-pending");
    expect(await redirectOf(() => saveOnboardingStep(form({ step: "1", name: "Another shop", category: "food" })))).toBe(
      "/sell",
    );
    expect(await redirectOf(() => sendForApproval(form({ guidelines: "yes" })))).toBe("/sell");
  });
});

/** Edit shop's form as Tech corner has it, with anything changed. */
const profile = (overrides: Record<string, string | string[] | File> = {}) =>
  form({
    name: "Tech corner",
    tagline: "Calculators, tested.",
    category: "tech",
    about: "I test everything.",
    campus: "midrand",
    pointsCampus: "midrand",
    pickupPoint: ["pp-midrand-library", "pp-midrand-reception"],
    slug: "tech-corner",
    ...overrides,
  });

describe("editing the shop (selling spec 2.11, plan decisions 16 and 17)", () => {
  it("saves the details, and says so", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(() => saveShopProfile(profile()));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sell/profile", "replace", true]);
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({
      tagline: "Calculators, tested.",
      about: "I test everything.",
    });
    expect((await readFormState(PROFILE_FORM))?.notice).toBe("shop-saved");
    expect(request.updatedTags).toEqual(["sellers"]);
  });

  it("keeps what was typed when something's wrong, and saves nothing", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveShopProfile(profile({ name: "", tagline: "a".repeat(81) })));
    expect(await readFormState(PROFILE_FORM)).toMatchObject({
      errors: ["name-missing", "tagline-length"],
      values: { name: "", category: "tech", campus: "midrand" },
    });
    expect((await getShopOf("acc-seller"))?.shop.tagline).toBe("Calculators, headsets and chargers, tested before you buy.");
    expect(request.updatedTags).toEqual([]);
  });

  it("changes the link once, and never to one another shop has", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveShopProfile(profile({ slug: "hair-studio" })));
    expect((await readFormState(PROFILE_FORM))?.errors).toEqual(["slug-taken"]);
    await redirectOf(() => saveShopProfile(profile({ slug: "Gadgets" })));
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "gadgets", slugChanged: true });
    await redirectOf(() => saveShopProfile(profile({ slug: "gizmos" })));
    expect((await getShopOf("acc-seller"))?.shop.slug).toBe("gadgets");
  });

  it("swaps the shop photo, or goes back to the category's picture", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveShopProfile(profile({ photo: photoFile(pngBytes()) })));
    const src = (await getShopOf("acc-seller"))!.shop.image!.src;
    expect(src).toMatch(/^\/photos\/ph-/);
    await redirectOf(() => saveShopProfile(profile({ removePhoto: "yes" })));
    expect((await getShopOf("acc-seller"))?.shop.image).toBeNull();
    expect(await getPhoto(photoIdOf(src)!, NOW)).toBeNull();
  });

  it("sends a student with no shop to /sell, changing nobody's shop", async () => {
    await signedInAs("acc-student");
    expect(await redirectOf(() => saveShopProfile(profile({ name: "Hijacked" })))).toBe("/sell");
    expect((await getShopOf("acc-seller"))?.shop.name).toBe("Tech corner");
  });
});

describe("pausing the shop (selling spec 2.8)", () => {
  it("pauses an approved shop and resumes it, saying so each time", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(() => pauseShop());
    expect([redirect.url, redirect.type]).toEqual(["/sell", "replace"]);
    expect((await getShopOf("acc-seller"))?.status).toBe("paused");
    expect((await readFormState(DASHBOARD_FORM))?.notice).toBe("shop-paused");
    await redirectOf(() => resumeShop());
    expect((await getShopOf("acc-seller"))?.status).toBe("approved");
    expect((await readFormState(DASHBOARD_FORM))?.notice).toBe("shop-resumed");
    expect(request.updatedTags).toEqual(["sellers", "sellers"]);
  });

  it("leaves a shop that's waiting for approval as it is", async () => {
    await signedInAs("acc-pending");
    await redirectOf(() => pauseShop());
    expect((await getShopOf("acc-pending"))?.status).toBe("pending");
    expect(request.updatedTags).toEqual([]);
  });
});
