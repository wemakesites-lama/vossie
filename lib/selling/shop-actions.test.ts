import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { getPhoto, photoIdOf, photoSrcsOf } from "@/lib/data/photos";
import { createSession } from "@/lib/data/sessions";
import { emptyDraft, getOnboardingDraft, getShopOf, saveOnboardingDraft } from "@/lib/data/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { PHOTO_MAX_BYTES } from "@/lib/photos/rules";
import { ascii, containsText, GPS, pngBytes, pngChunk, pngFile } from "@/tests/helpers/image-bytes";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { DASHBOARD_FORM, onboardingForm, PROFILE_FORM } from "./form-state";
import { pauseShop, resumeShop, saveOnboardingStep, saveShopProfile, sendForApproval } from "./shop-actions";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
/** The session token of the browser a post comes from, when a test sends posts from two browsers at once. */
const browser = await vi.hoisted(async () => new (await import("node:async_hooks")).AsyncLocalStorage<string>());

vi.mock("next/headers", async () => {
  const headers = (await import("@/tests/helpers/next-request")).nextHeaders(request);
  return {
    ...headers,
    // A post from fromBrowser() carries that browser's session cookie, whatever another post at the same time has.
    cookies: async () => {
      const jar = await headers.cookies();
      const token = browser.getStore();
      if (token === undefined) return jar;
      // Imported here, not in the factory: lib/auth/cookies imports next/headers itself.
      const { SESSION_COOKIE: session } = await import("@/lib/auth/cookies");
      return { ...jar, get: (name: string) => (name === session ? { name, value: token } : jar.get(name)) };
    },
  };
});
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

/** A stored session for `accountId` in a second browser, whose posts go through fromBrowser(token, …). */
async function sessionIn(token: string, accountId: string) {
  await createSession({ key: hashToken(token), accountId, createdAt: NOW, expiresAt: IN_30_DAYS });
}

/** Runs `run` as a post (or a read) from the browser holding `token`. */
const fromBrowser = <T,>(token: string, run: () => Promise<T>): Promise<T> => browser.run(token, run);

/** The shop's photo is stored with the shop's use (or is a placeholder, or none), and the shop keeps no other. */
async function expectOnlyTheShopsPhoto(accountId: string) {
  const src = (await getShopOf(accountId))?.shop.image?.src ?? null;
  expect(await photoSrcsOf(accountId, "shop")).toEqual(new Set(src && photoIdOf(src) ? [src] : []));
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

  it("stores a shop photo stripped of its location, and keeps it when step 3 is sent again with no file", async () => {
    await signedInAs("acc-student");
    const withPhoto = form({ step: "3", photo: photoFile(pngBytes({ exif: true, text: true })) });
    expect(await redirectOf(() => saveOnboardingStep(withPhoto))).toBe("/sell/onboarding?step=4");
    const src = (await getOnboardingDraft("acc-student"))!.photoSrc!;
    const stored = await getPhoto(photoIdOf(src)!);
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

  it("keeps one draft photo when step 3 is sent twice at once with a file (a double click)", async () => {
    await signedInAs("acc-student");
    const step3 = () => form({ step: "3", photo: photoFile(pngBytes()) });
    await Promise.all([redirectOf(() => saveOnboardingStep(step3())), redirectOf(() => saveOnboardingStep(step3()))]);
    const src = (await getOnboardingDraft("acc-student"))!.photoSrc!;
    expect(await photoSrcsOf("acc-student", "draft")).toEqual(new Set([src]));
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

  it("gives the new shop only the draft's points still in use (staff tools spec 2.3)", async () => {
    await signedInAs("acc-student");
    await saveOnboardingDraft({ ...finishedDraft(), pickupPointIds: ["pp-midrand-library", "pp-midrand-reception"] });
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = NOW.toISOString();
    expect(await redirectOf(() => sendForApproval(form({ guidelines: "yes" })))).toBe("/sell");
    expect((await getShopOf("acc-student"))?.shop.pickupPointIds).toEqual(["pp-midrand-reception"]);
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

  it("lets only one of two students sending at once take a name on a campus; the other goes back to step 1", async () => {
    await sessionIn("token-m", "acc-mentor");
    await sessionIn("token-a", "acc-admin");
    await saveOnboardingDraft({ ...finishedDraft(), accountId: "acc-mentor" });
    await saveOnboardingDraft({ ...finishedDraft(), accountId: "acc-admin" });
    const send = (token: string) => fromBrowser(token, () => redirectOf(() => sendForApproval(form({ guidelines: "yes" }))));
    const [mentor, admin] = await Promise.all([send("token-m"), send("token-a")]);
    expect([mentor, admin].sort()).toEqual(["/sell", "/sell/onboarding"]);
    const named = [...sampleStore().sellers.values()].filter((row) => row.name === "Zola's Bakes");
    expect(named).toHaveLength(1);
    const loser = named[0].ownerId === "acc-mentor" ? "token-a" : "token-m";
    expect((await fromBrowser(loser, () => readFormState(onboardingForm(1))))?.errors).toEqual(["name-taken"]);
  });

  it("treats a step outside 1 to 5 as step 1", async () => {
    await signedInAs("acc-student");
    const redirect = await redirectOf(() =>
      saveOnboardingStep(form({ step: "9", name: "Zola's Bakes", category: "food", about: "Not step 2." })),
    );
    expect(redirect).toBe("/sell/onboarding?step=2");
    expect(await getOnboardingDraft("acc-student")).toMatchObject({ name: "Zola's Bakes", about: "" });
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

  it("leaves a listing on its retired point when only the tagline changes (staff tools spec 2.3)", async () => {
    await signedInAs("acc-seller");
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = NOW.toISOString();
    await redirectOf(() => saveShopProfile(profile({ tagline: "New tagline.", pickupPoint: ["pp-midrand-reception"] })));
    expect((await getShopOf("acc-seller"))?.shop.tagline).toBe("New tagline.");
    expect(sampleStore().listings.get("l-001")?.pickupPointId).toBe("pp-midrand-library");
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

  it("takes a link change sent twice at once (a double click) as one change, and saves the rest", async () => {
    await signedInAs("acc-seller");
    const twice = () => profile({ slug: "gadgets", tagline: "Tested twice." });
    await Promise.all([redirectOf(() => saveShopProfile(twice())), redirectOf(() => saveShopProfile(twice()))]);
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "gadgets", tagline: "Tested twice." });
    // Both posts saved; neither came back with an error.
    expect(request.updatedTags).toEqual(["sellers", "sellers"]);
    expect(await readFormState(PROFILE_FORM)).toMatchObject({ errors: [], notice: "shop-saved" });
  });

  it("doesn't refuse the shop's own new link to a second post that read the shop before the change", async () => {
    await signedInAs("acc-seller");
    // The second post carries a photo, so it reads the shop, then waits on the file while the first changes the link.
    const first = profile({ slug: "gadgets" });
    const second = profile({ slug: "gadgets", tagline: "With a photo.", photo: photoFile(pngBytes()) });
    await Promise.all([redirectOf(() => saveShopProfile(second)), redirectOf(() => saveShopProfile(first))]);
    const own = await getShopOf("acc-seller");
    expect(own?.shop.slug).toBe("gadgets");
    expect(request.updatedTags).toEqual(["sellers", "sellers"]);
    expect((await readFormState(PROFILE_FORM))?.errors).toEqual([]);
    expect(own?.shop.image?.src).toMatch(/^\/photos\/ph-/);
  });

  it("says the one change is spent when two different link changes race", async () => {
    await signedInAs("acc-seller");
    // The second post read the shop first, then waits on its photo while the first changes the link.
    const second = profile({ slug: "gizmos", tagline: "Lost.", photo: photoFile(pngBytes()) });
    await Promise.all([
      redirectOf(() => saveShopProfile(second)),
      redirectOf(() => saveShopProfile(profile({ slug: "gadgets" }))),
    ]);
    expect(await readFormState(PROFILE_FORM)).toMatchObject({
      errors: ["slug-used"],
      values: { slug: "gizmos", tagline: "Lost." },
    });
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "gadgets", slugChanged: true });
    expect((await getShopOf("acc-seller"))?.shop.tagline).not.toBe("Lost.");
    expect(request.updatedTags).toEqual(["sellers"]);
  });

  it("lets only one of two shops take a name on a campus when both save it at once", async () => {
    await sessionIn("token-s", "acc-seller");
    await sessionIn("token-p", "acc-pending");
    const hookClub = () => profile({ name: "Hook club" });
    const [seller, pending] = await Promise.all([
      fromBrowser("token-s", () => redirectOf(() => saveShopProfile(hookClub()))),
      fromBrowser("token-p", () => redirectOf(() => saveShopProfile(hookClub()))),
    ]);
    expect([seller, pending]).toEqual(["/sell/profile", "/sell/profile"]);
    const named = [...sampleStore().sellers.values()].filter((row) => row.name === "Hook club");
    expect(named).toHaveLength(1);
    const loser = named[0].ownerId === "acc-seller" ? "token-p" : "token-s";
    expect((await fromBrowser(loser, () => readFormState(PROFILE_FORM)))?.errors).toEqual(["name-taken"]);
  });

  it("tells a tab drawn before the link changed that the change is spent, saving nothing", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveShopProfile(profile({ slug: "gadgets", slugWas: "tech-corner" })));
    // The other tab still shows tech-corner, and its seller types another link.
    await redirectOf(() => saveShopProfile(profile({ slug: "gizmos", slugWas: "tech-corner", tagline: "Old tab." })));
    expect(await readFormState(PROFILE_FORM)).toMatchObject({ errors: ["slug-used"], values: { slug: "gizmos" } });
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "gadgets", tagline: "Calculators, tested." });
    // Left as the tab showed it, the link stays as it is now, and the rest saves.
    await redirectOf(() => saveShopProfile(profile({ slug: "tech-corner", slugWas: "tech-corner", tagline: "Old tab." })));
    expect((await readFormState(PROFILE_FORM))?.notice).toBe("shop-saved");
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "gadgets", tagline: "Old tab." });
  });

  it("checks the link the form was drawn with like any link, ignoring one that isn't", async () => {
    await signedInAs("acc-seller");
    // A link that isn't one can't stand for what the form showed: the typed link is a change, made once.
    await redirectOf(() => saveShopProfile(profile({ slug: "gadgets", slugWas: "Gadgets!" })));
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "gadgets", slugChanged: true });
    await redirectOf(() => saveShopProfile(profile({ slug: "gizmos", slugWas: "../gizmos", tagline: "Tampered." })));
    expect((await readFormState(PROFILE_FORM))?.errors).toEqual(["slug-used"]);
    expect((await getShopOf("acc-seller"))?.shop.slug).toBe("gadgets");
  });

  it("leaves a waiting shop's link alone when one is posted: it follows the name until approval", async () => {
    await signedInAs("acc-pending");
    const waiting = profile({ name: "Crochet corner", campus: "pretoria", pointsCampus: "pretoria" });
    waiting.set("pickupPoint", "pp-pretoria-library");
    waiting.set("slug", "hooks-and-yarn");
    expect(await redirectOf(() => saveShopProfile(waiting))).toBe("/sell/profile");
    expect((await readFormState(PROFILE_FORM))?.notice).toBe("shop-saved");
    expect((await getShopOf("acc-pending"))?.shop).toMatchObject({ slug: "crochet-corner", slugChanged: false });
    expect(sampleStore().sellers.has("hooks-and-yarn")).toBe(false);
  });

  it("lets a paused shop change its link", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => pauseShop());
    await redirectOf(() => saveShopProfile(profile({ slug: "gadgets" })));
    expect(await getShopOf("acc-seller")).toMatchObject({ status: "paused", shop: { slug: "gadgets" } });
  });

  it("refuses a link a shop has left, which buyers may still have saved", async () => {
    await signedInAs("acc-seller");
    sampleStore().retiredSlugs.add("old-gadgets");
    await redirectOf(() => saveShopProfile(profile({ slug: "old-gadgets" })));
    expect((await readFormState(PROFILE_FORM))?.errors).toEqual(["slug-taken"]);
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "tech-corner", slugChanged: false });
  });

  it("refuses an oversized or unreadable shop photo, storing nothing", async () => {
    await signedInAs("acc-seller");
    const before = (await getShopOf("acc-seller"))!.shop.image;
    const big = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "big.png", { type: "image/png" });
    await redirectOf(() => saveShopProfile(profile({ photo: big, tagline: "Big." })));
    expect((await readFormState(PROFILE_FORM))?.errors).toEqual(["photo-size"]);
    // A PNG's signature with no image in it.
    const broken = photoFile(pngFile(pngChunk("IEND", new Uint8Array())), "broken.png");
    await redirectOf(() => saveShopProfile(profile({ photo: broken, tagline: "Broken." })));
    expect((await readFormState(PROFILE_FORM))?.errors).toEqual(["photo-unreadable"]);
    expect(sampleStore().photos.size).toBe(0);
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({
      image: before,
      tagline: "Calculators, headsets and chargers, tested before you buy.",
    });
  });

  it("swaps the shop photo, or goes back to the category's picture", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveShopProfile(profile({ photo: photoFile(pngBytes()) })));
    const src = (await getShopOf("acc-seller"))!.shop.image!.src;
    expect(src).toMatch(/^\/photos\/ph-/);
    await redirectOf(() => saveShopProfile(profile({ removePhoto: "yes" })));
    expect((await getShopOf("acc-seller"))?.shop.image).toBeNull();
    expect(await getPhoto(photoIdOf(src)!)).toBeNull();
  });

  for (const order of ["the removal first", "the edit first"]) {
    it(`never leaves the shop on a deleted photo when a removal and an edit cross (${order})`, async () => {
      await signedInAs("acc-seller");
      await redirectOf(() => saveShopProfile(profile({ photo: photoFile(pngBytes()) })));
      const remove = () => redirectOf(() => saveShopProfile(profile({ removePhoto: "yes", tagline: "Removed." })));
      const edit = () => redirectOf(() => saveShopProfile(profile({ tagline: "Edited." })));
      await Promise.all(order === "the removal first" ? [remove(), edit()] : [edit(), remove()]);
      expect((await getShopOf("acc-seller"))?.shop.image).toBeNull();
      await expectOnlyTheShopsPhoto("acc-seller");
    });
  }

  it("keeps one shop photo when a new photo is sent twice at once (a double click)", async () => {
    await signedInAs("acc-seller");
    const upload = () => profile({ photo: photoFile(pngBytes()) });
    await Promise.all([redirectOf(() => saveShopProfile(upload())), redirectOf(() => saveShopProfile(upload()))]);
    expect((await getShopOf("acc-seller"))?.shop.image?.src).toMatch(/^\/photos\/ph-/);
    await expectOnlyTheShopsPhoto("acc-seller");
  });

  it("takes a new photo over Remove the photo when both are sent, as choosing the file came last", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveShopProfile(profile({ photo: photoFile(pngBytes()) })));
    const old = (await getShopOf("acc-seller"))!.shop.image!.src;
    await redirectOf(() => saveShopProfile(profile({ removePhoto: "yes", photo: photoFile(pngBytes()) })));
    const now = (await getShopOf("acc-seller"))?.shop.image?.src;
    expect(now).toMatch(/^\/photos\/ph-/);
    expect(now).not.toBe(old);
    expect(await getPhoto(photoIdOf(old)!)).toBeNull();
    await expectOnlyTheShopsPhoto("acc-seller");
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
