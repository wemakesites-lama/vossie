import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { addFollow } from "@/lib/data/follows";
import { readCoverPhoto } from "@/lib/data/listing-ai";
import { FAKE_REPLY } from "@/lib/data/listing-ai/fake";
import { getNotifications } from "@/lib/data/notifications";
import { getOwnListing, listOwnListings, setOwnListingState } from "@/lib/data/own-listings";
import { attachPhotos, getPhoto, photoIdOf, storePhotos } from "@/lib/data/photos";
import { addSavedSearch, listSavedSearches, setSavedSearchPaused } from "@/lib/data/saved-searches";
import { createSession } from "@/lib/data/sessions";
import { setShopPaused } from "@/lib/data/shops";
import { staffPauseShop, staffResumeShop } from "@/lib/data/staff-shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { DAY_MS, KEEP_MAX } from "@/lib/messaging/rules";
import type { MatchQuery } from "@/lib/types";
import { ascii, containsText, GPS, pngBytes } from "@/tests/helpers/image-bytes";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import {
  issueListingToken,
  listingForm,
  LISTING_TOKEN_TTL_MS,
  MY_LISTINGS_FORM,
  takeListingToken,
  takeNotice,
  threadSoldForm,
} from "./form-state";
import { changeListingState, deleteListingForm, saveListingForm } from "./listing-actions";
import { resumeShop } from "./shop-actions";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/listing-ai", () => ({ readCoverPhoto: vi.fn() }));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");
const COVER = "/placeholders/listing/tech.svg";
const BACK = "/placeholders/photo/2.svg";
const CASE = "/placeholders/photo/3.svg";

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

function form(fields: Record<string, string | string[] | File | File[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

async function signedInAs(accountId: string) {
  await createSession({ key: hashToken("token-1"), accountId, createdAt: NOW, expiresAt: IN_30_DAYS });
  request.cookies.set(SESSION_COOKIE, "token-1");
}

const photoFile = (bytes: Uint8Array<ArrayBuffer>, name = "photo.png") => new File([bytes], name, { type: "image/png" });

/** A new-listing form's one-time token, as the form draws it for whoever is signed in ("" when nobody is). */
const freshToken = async () => (await issueListingToken()) ?? "";

/** A good listing form for Tech corner: a desk fan at the library, to publish, with a new token as the form carries. */
const fanForm = async (overrides: Record<string, string | string[] | File | File[]> = {}) =>
  form({
    once: await freshToken(),
    kind: "item",
    title: "Desk fan",
    category: "res-living",
    condition: "good",
    price: "150",
    payMode: "cash",
    description: "Quiet and strong.",
    handover: "pickup",
    pickup: "pp-midrand-library",
    intent: "publish",
    ...overrides,
  });

const fan = async () => (await listOwnListings("tech-corner")).find((row) => row.title === "Desk fan");

describe("saving a listing (selling spec 2.10, plan decisions 3 and 4)", () => {
  it("publishes a new listing and lands on Available, saying so", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(async () => saveListingForm(await fanForm()));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sell/listings", "replace", true]);
    const row = (await fan())!;
    expect(row).toMatchObject({ state: "available", priceZar: 150, campusSlug: "midrand", photos: [] });
    expect(request.updatedTags).toEqual(["listings"]);
    expect(await readFormState(MY_LISTINGS_FORM)).toMatchObject({ notice: "published", values: { listing: row.id } });
  });

  it("saves a draft, and a waiting shop's Save and publish as a draft too", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(async () => saveListingForm(await fanForm({ intent: "draft" })))).toBe("/sell/listings?tab=drafts");
    expect((await fan())?.state).toBe("draft");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("drafted");
    await signedInAs("acc-pending");
    await redirectOf(async () => saveListingForm(await fanForm({ pickup: "pp-pretoria-library" })));
    expect((await listOwnListings("crochet-corner"))[0]).toMatchObject({ title: "Desk fan", state: "draft" });
  });

  it("offers no retired pickup point to a save, though a listing already on one keeps it until it's saved (staff tools amendment 5)", async () => {
    await signedInAs("acc-seller");
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = NOW.toISOString();
    expect((await getOwnListing("tech-corner", "l-001"))?.pickupPointId).toBe("pp-midrand-library");
    expect(await redirectOf(async () => saveListingForm(await fanForm()))).toBe("/sell/listings/new");
    expect((await readFormState(listingForm(null)))?.errors).toEqual(["pickup-missing"]);
    expect(await fan()).toBeUndefined();
    await redirectOf(async () => saveListingForm(await fanForm({ pickup: "pp-midrand-reception" })));
    expect((await fan())?.pickupPointId).toBe("pp-midrand-reception");
  });

  it("keeps everything typed, the errors and the uploaded photo when a save fails", async () => {
    await signedInAs("acc-seller");
    const failing = await fanForm({ title: "", price: "lots", newPhotos: photoFile(pngBytes()) });
    expect(await redirectOf(() => saveListingForm(failing))).toBe("/sell/listings/new");
    const state = (await readFormState(listingForm(null)))!;
    expect(state.errors).toEqual(["title-missing", "price-invalid"]);
    expect(state.values).toMatchObject({ title: "", price: "lots", category: "res-living" });
    expect(state.values.photos).toMatch(/^\/photos\/ph-/);
    expect(await getPhoto(photoIdOf(state.values.photos)!, NOW)).not.toBeNull();
    expect(await fan()).toBeUndefined();
  });

  it("strips each upload, puts the photos in the order posted, and keeps each one's description", async () => {
    await signedInAs("acc-seller");
    const posted = await fanForm({
      photo: ["new:1", "new:0"],
      newPhotos: [photoFile(pngBytes({ exif: true }), "back.png"), photoFile(pngBytes({ text: true }), "front.png")],
      "alt:new:1": " The fan from the front ",
    });
    await redirectOf(() => saveListingForm(posted));
    const [front, back] = (await fan())!.photos;
    expect([front.alt, back.alt]).toEqual(["The fan from the front", ""]);
    for (const photo of [front, back]) {
      expect(containsText((await getPhoto(photoIdOf(photo.src)!, NOW))!.bytes, GPS)).toBe(false);
    }
  });

  it("moves a photo without saving the listing, keeping what was typed, and comes back to the photos", async () => {
    await signedInAs("acc-seller");
    const moving = await fanForm({
      listing: "l-001",
      title: "Typed but not saved",
      photo: [COVER, BACK, CASE],
      photoMove: `${CASE}:cover`,
    });
    // Back to the photos' legend, above the list, not the file input below it (amendment 11.4).
    expect(await redirectOf(() => saveListingForm(moving))).toBe("/sell/listings/l-001/edit#edit-l-001-photos-title");
    const state = (await readFormState(listingForm("l-001")))!;
    expect(state.values).toMatchObject({ title: "Typed but not saved", photos: [CASE, COVER, BACK].join("\n") });
    expect((await getOwnListing("tech-corner", "l-001"))?.title).toBe("Casio fx-991ZA Plus calculator");
    expect(request.updatedTags).toEqual([]);
  });

  it("refuses a file that isn't a photo, and photos past the sixth", async () => {
    await signedInAs("acc-seller");
    const files = [ascii("GIF89a"), pngBytes(), pngBytes(), pngBytes(), pngBytes()].map((bytes) => photoFile(bytes));
    await redirectOf(async () => saveListingForm(await fanForm({ listing: "l-001", photo: [COVER, BACK, CASE], newPhotos: files })));
    const state = (await readFormState(listingForm("l-001")))!;
    expect(state.errors).toEqual(["photo-type", "photo-count"]);
    expect(state.values.photos.split("\n")).toHaveLength(6);
  });

  it("drops photos that aren't the seller's own", async () => {
    const [theirs] = await storePhotos("acc-student", [{ type: "image/png", bytes: pngBytes() }], NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ photo: [theirs, "/placeholders/listing/food.svg"] })));
    expect((await fan())?.photos).toEqual([]);
  });

  it("never uses a photo of another of the seller's listings (amendment 10.7)", async () => {
    await signedInAs("acc-seller");
    const [theirs] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    await attachPhotos("acc-seller", [theirs], "listing:l-002");
    await redirectOf(async () => saveListingForm(await fanForm({ photo: [theirs] })));
    expect((await fan())?.photos).toEqual([]);
    await redirectOf(async () => saveListingForm(await fanForm({ listing: "l-001", photo: [COVER, theirs] })));
    expect((await getOwnListing("tech-corner", "l-001"))?.photos.map((photo) => photo.src)).toEqual([COVER]);
    // The photo still belongs to the listing it was given to.
    expect(sampleStore().photos.get(photoIdOf(theirs)!)?.use).toBe("listing:l-002");
  });

  it("drops a waiting photo a day old from a listing saved the next day, and keeps the other photos (amendment 10.1)", async () => {
    await signedInAs("acc-seller");
    const [waiting] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    const nextDay = new Date(NOW.getTime() + DAY_MS + 60_000);
    vi.setSystemTime(nextDay);
    await redirectOf(async () => saveListingForm(await fanForm({ listing: "l-001", photo: [COVER, waiting, BACK] })));
    expect((await getOwnListing("tech-corner", "l-001"))?.photos.map((photo) => photo.src)).toEqual([COVER, BACK]);
    expect(await getPhoto(photoIdOf(waiting)!, nextDay)).toBeNull();
  });

  it("drops it from the photo buttons' answer too, so the form never shows a photo that has gone (amendment 10.1)", async () => {
    await signedInAs("acc-seller");
    const [waiting] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS + 60_000));
    const moving = await fanForm({ listing: "l-001", photo: [COVER, waiting, BACK], photoMove: `${BACK}:cover` });
    await redirectOf(() => saveListingForm(moving));
    expect((await readFormState(listingForm("l-001")))?.values.photos).toBe([BACK, COVER].join("\n"));
  });

  it("keeps only bounded values when a save fails: a choice that isn't one of its choices is kept as nothing (amendment 10.2)", async () => {
    await signedInAs("acc-seller");
    const huge = "x".repeat(1_000_000);
    const failing = await fanForm({
      title: huge,
      price: huge,
      swapFor: huge,
      description: huge,
      kind: huge,
      category: huge,
      condition: huge,
      free: huge,
      from: huge,
      payMode: huge,
      handover: huge,
      pickup: huge,
    });
    await redirectOf(() => saveListingForm(failing));
    const { values } = (await readFormState(listingForm(null)))!;
    for (const name of ["kind", "category", "condition", "free", "from", "payMode", "handover", "pickup"]) {
      expect(values[name], name).toBe("");
    }
    for (const [name, value] of Object.entries(values)) expect(value.length, name).toBeLessThanOrEqual(KEEP_MAX);
  });

  it("keeps a good choice as it was typed when a save fails (amendment 10.2)", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () =>
      saveListingForm(await fanForm({ title: "", kind: "service", condition: "fair", free: "yes", from: "yes", handover: "online" })),
    );
    expect((await readFormState(listingForm(null)))!.values).toMatchObject({
      kind: "service",
      category: "res-living",
      condition: "fair",
      free: "yes",
      from: "yes",
      payMode: "cash",
      handover: "online",
      pickup: "pp-midrand-library",
    });
  });

  it("applies a Remove before it works out the room, so a full listing takes the new photo (amendment 10.3)", async () => {
    await signedInAs("acc-seller");
    const six = [COVER, BACK, CASE, "/placeholders/photo/4.svg", "/placeholders/photo/5.svg", "/placeholders/photo/6.svg"];
    sampleStore().listings.get("l-001")!.photos = six.map((src) => ({ src, alt: "" }));
    const posted = await fanForm({
      listing: "l-001",
      photo: six,
      newPhotos: photoFile(pngBytes()),
      photoMove: `${six[5]}:remove`,
    });
    await redirectOf(() => saveListingForm(posted));
    const state = (await readFormState(listingForm("l-001")))!;
    expect(state.errors).toEqual([]);
    const shown = state.values.photos.split("\n");
    expect(shown).toHaveLength(6);
    expect(shown.slice(0, 5)).toEqual(six.slice(0, 5));
    expect(shown[5]).toMatch(/^\/photos\/ph-/);
  });

  it("tells a paused shop that buyers will see a published listing when the shop resumes, not now (amendment 11.6)", async () => {
    await signedInAs("acc-seller");
    await setShopPaused("acc-seller", true);
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect((await fan())?.state).toBe("available");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("saved-shop-paused");
    // A draft says what it always says.
    await redirectOf(async () => saveListingForm(await fanForm({ title: "Kettle", intent: "draft" })));
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("drafted");
  });

  it("tells a shop the Hub paused that the Hub resumes it, not the seller, on a publish (staff tools plan decision 3)", async () => {
    await signedInAs("acc-seller");
    await staffPauseShop("tech-corner", "Selling exam answers.");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect((await fan())?.state).toBe("available");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("saved-shop-hub-paused");
  });

  it("saves changes to a listing, and keeps a sold one sold", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(async () => saveListingForm(await fanForm({ listing: "l-001", title: "Desk fan" })))).toBe(
      "/sell/listings",
    );
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("saved");
    await setOwnListingState("tech-corner", "l-001", "sold", NOW);
    expect(await redirectOf(async () => saveListingForm(await fanForm({ listing: "l-001" })))).toBe("/sell/listings?tab=sold");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("sold");
  });
});

describe("a new listing is made once, however many times its form is sent (selling plan amendment 14.1)", () => {
  const desks = async () => (await listOwnListings("tech-corner")).filter((row) => row.title === "Desk fan");
  const send = (overrides: Record<string, string | string[] | File | File[]>) =>
    redirectSignalOf(async () => saveListingForm(await fanForm(overrides)));

  it("makes one listing from two posts with one token, and sends the second where the first went, with its notice", async () => {
    await signedInAs("acc-seller");
    const once = await freshToken();
    expect((await send({ once })).url).toBe("/sell/listings");
    const [row] = await desks();
    // My listings took the first notice when it was shown.
    expect(await takeNotice(MY_LISTINGS_FORM)).toMatchObject({ notice: "published", values: { listing: row.id } });
    const again = await send({ once, title: "Desk fan, second go" });
    expect([again.url, again.type, request.refreshed]).toEqual(["/sell/listings", "replace", true]);
    expect(await desks()).toHaveLength(1);
    expect((await listOwnListings("tech-corner")).some((listing) => listing.title === "Desk fan, second go")).toBe(false);
    // Said again, so the second page shows what the first did.
    expect(await readFormState(MY_LISTINGS_FORM)).toMatchObject({ notice: "published", values: { listing: row.id } });
    // Only the save that made the listing told buyers' pages.
    expect(request.updatedTags).toEqual(["listings"]);
  });

  it("sends a second post of a draft to Drafts, with the draft's notice", async () => {
    await signedInAs("acc-seller");
    const once = await freshToken();
    await send({ once, intent: "draft" });
    expect((await send({ once, intent: "draft" })).url).toBe("/sell/listings?tab=drafts");
    expect(await desks()).toHaveLength(1);
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("drafted");
  });

  it("makes one listing when two posts are sent together, as a browser without the app's JavaScript can", async () => {
    await signedInAs("acc-seller");
    const once = await freshToken();
    const results = await Promise.all([send({ once }), send({ once }), send({ once })]);
    expect(results.map((signal) => signal.url)).toEqual(["/sell/listings", "/sell/listings", "/sell/listings"]);
    expect(await desks()).toHaveLength(1);
    expect(request.updatedTags).toEqual(["listings"]);
  });

  it("sends a post that comes while the first is still saving to My listings, by its own button, and makes nothing", async () => {
    await signedInAs("acc-seller");
    const once = await freshToken();
    // The first has taken the token and has not said where it went.
    expect(await takeListingToken(once, NOW)).toEqual({ kind: "first" });
    expect((await send({ once })).url).toBe("/sell/listings");
    expect((await send({ once, intent: "draft" })).url).toBe("/sell/listings?tab=drafts");
    expect(await desks()).toHaveLength(0);
    expect(await readFormState(MY_LISTINGS_FORM)).toBeNull();
  });

  it("does the second post's work for nothing: no photo is stored, and nothing is checked (amendment 14.1)", async () => {
    await signedInAs("acc-seller");
    const once = await freshToken();
    await send({ once, newPhotos: photoFile(pngBytes()) });
    const stored = sampleStore().photos.size;
    expect(stored).toBe(1);
    // The same post again, even one that would fail its checks, stores nothing and goes where the first went.
    expect((await send({ once, title: "", newPhotos: photoFile(pngBytes()) })).url).toBe("/sell/listings");
    expect(sampleStore().photos.size).toBe(stored);
    expect(await readFormState(listingForm(null))).toBeNull();
  });

  it("gives each token its own listing, so two forms open at once each make one", async () => {
    await signedInAs("acc-seller");
    await send({ title: "Desk fan" });
    await send({ title: "Desk fan" });
    expect(await desks()).toHaveLength(2);
  });

  it("refuses a post with no token, a made-up one or a badly shaped one: its error, what was typed and its photos kept", async () => {
    await signedInAs("acc-seller");
    for (const once of ["", "00000000-0000-4000-8000-000000000000", "not-a-token"]) {
      const photo = photoFile(pngBytes());
      expect((await send({ once, newPhotos: photo })).url, once).toBe("/sell/listings/new");
      const state = (await readFormState(listingForm(null)))!;
      expect(state.errors, once).toEqual(["form-expired"]);
      expect(state.values, once).toMatchObject({ title: "Desk fan", price: "150", category: "res-living" });
      expect(state.values.photos, once).toMatch(/^\/photos\/ph-/);
      expect(await desks(), once).toHaveLength(0);
    }
    expect(await readFormState(MY_LISTINGS_FORM)).toBeNull();
    expect(request.updatedTags).toEqual([]);
  });

  it("refuses a token that has run out, and one drawn for another session", async () => {
    await signedInAs("acc-seller");
    const old = await freshToken();
    vi.setSystemTime(new Date(NOW.getTime() + LISTING_TOKEN_TTL_MS + 1000));
    expect((await send({ once: old })).url).toBe("/sell/listings/new");
    expect((await readFormState(listingForm(null)))?.errors).toEqual(["form-expired"]);
    // Another browser's session can't use it either.
    const mine = await freshToken();
    request.cookies.clear();
    await createSession({
      key: hashToken("token-2"),
      accountId: "acc-seller",
      createdAt: NOW,
      expiresAt: IN_30_DAYS,
    });
    request.cookies.set(SESSION_COOKIE, "token-2");
    expect((await send({ once: mine })).url).toBe("/sell/listings/new");
    expect(await desks()).toHaveLength(0);
  });

  it("lets the form be sent again with the token the page draws after a refusal", async () => {
    await signedInAs("acc-seller");
    await send({ once: "" });
    expect((await send({})).url).toBe("/sell/listings");
    expect(await desks()).toHaveLength(1);
  });

  it("keeps the token when a save fails its checks or a photo button is pressed, so the same form can go on", async () => {
    await signedInAs("acc-seller");
    const once = await freshToken();
    expect((await send({ once, title: "" })).url).toBe("/sell/listings/new");
    const photo = "/placeholders/photo/2.svg";
    expect((await send({ once, photo: [photo], photoMove: `${photo}:remove` })).url).toBe(
      "/sell/listings/new#new-photos-title",
    );
    expect(await desks()).toHaveLength(0);
    expect((await send({ once })).url).toBe("/sell/listings");
    expect(await desks()).toHaveLength(1);
  });

  it("needs no token to save changes to a listing, which saving twice can't duplicate", async () => {
    await signedInAs("acc-seller");
    for (const once of ["", "00000000-0000-4000-8000-000000000000"]) {
      expect((await send({ once, listing: "l-001", title: "Desk fan" })).url, once).toBe("/sell/listings");
    }
    expect((await getOwnListing("tech-corner", "l-001"))?.title).toBe("Desk fan");
    expect((await listOwnListings("tech-corner")).filter((row) => row.title === "Desk fan")).toHaveLength(1);
  });
});

describe("My listings' buttons and Delete listing (selling spec 2.9, plan decision 3)", () => {
  it("pauses, resumes, marks sold and relists, coming back to the same tab and saying so", async () => {
    await signedInAs("acc-seller");
    const move = (to: string, tab: string) => redirectOf(() => changeListingState(form({ listing: "l-001", to, tab })));
    expect(await move("paused", "available")).toBe("/sell/listings");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("paused");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("paused");
    expect(await move("available", "paused")).toBe("/sell/listings?tab=paused");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("resumed");
    await move("sold", "available");
    await move("available", "sold");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("available");
    await move("draft", "available");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("available");
    expect(request.updatedTags).toEqual(["listings", "listings", "listings", "listings"]);
  });

  it("marks a listing sold from its selling thread and goes back there, saying so (role views N2)", async () => {
    await signedInAs("acc-seller");
    const post = form({ listing: "l-001", to: "sold", tab: "available", thread: "conv-s2" });
    expect(await redirectOf(() => changeListingState(post))).toBe("/messages/conv-s2");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("sold");
    expect((await readFormState(threadSoldForm("conv-s2")))?.notice).toBe("sold");
    expect(await readFormState(MY_LISTINGS_FORM)).toBeNull();
    // listingsChanged() ran before done()'s redirect; a second press changes nothing and expires nothing more.
    expect(await redirectOf(() => changeListingState(post))).toBe("/messages/conv-s2");
    expect(request.updatedTags).toEqual(["listings"]);
  });

  it("lets only the listing's owner mark it sold from a thread", async () => {
    await signedInAs("acc-pending");
    const post = form({ listing: "l-001", to: "sold", tab: "available", thread: "conv-s2" });
    expect(await redirectOf(() => changeListingState(post))).toBe("/messages/conv-s2");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("available");
    expect(await readFormState(threadSoldForm("conv-s2"))).toBeNull();
    expect(request.updatedTags).toEqual([]);
  });

  it("goes back to My listings when the thread field isn't an id", async () => {
    await signedInAs("acc-seller");
    const post = form({ listing: "l-001", to: "sold", tab: "available", thread: "https://example.com" });
    expect(await redirectOf(() => changeListingState(post))).toBe("/sell/listings");
  });

  it("tells a paused shop the truth on Resume and Relist, and keeps Pause's and Mark sold's words (amendment 11.6)", async () => {
    await signedInAs("acc-seller");
    await setShopPaused("acc-seller", true);
    const move = async (to: string, tab: string) => {
      await redirectOf(() => changeListingState(form({ listing: "l-001", to, tab })));
      return (await readFormState(MY_LISTINGS_FORM))?.notice;
    };
    expect(await move("paused", "available")).toBe("paused");
    expect(await move("available", "paused")).toBe("saved-shop-paused");
    expect(await move("sold", "available")).toBe("sold");
    expect(await move("available", "sold")).toBe("saved-shop-paused");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("available");
  });

  it("tells a shop the Hub paused that the Hub resumes it, on Resume and Relist too (staff tools plan decision 3)", async () => {
    await signedInAs("acc-seller");
    await staffPauseShop("tech-corner", "Selling exam answers.");
    const move = async (to: string, tab: string) => {
      await redirectOf(() => changeListingState(form({ listing: "l-001", to, tab })));
      return (await readFormState(MY_LISTINGS_FORM))?.notice;
    };
    expect(await move("paused", "available")).toBe("paused");
    expect(await move("available", "paused")).toBe("saved-shop-hub-paused");
    expect(await move("sold", "available")).toBe("sold");
    expect(await move("available", "sold")).toBe("saved-shop-hub-paused");
    // The shop comes back as the seller's own pause when the Hub resumes it, so the old words are right again.
    await staffResumeShop("tech-corner");
    await setShopPaused("acc-seller", true);
    expect(await move("paused", "available")).toBe("paused");
    expect(await move("available", "paused")).toBe("saved-shop-paused");
  });

  it("deletes a listing and its photos, saying so", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ newPhotos: photoFile(pngBytes()) })));
    const row = (await fan())!;
    expect(await redirectOf(() => deleteListingForm(form({ listing: row.id })))).toBe("/sell/listings");
    expect(await getOwnListing("tech-corner", row.id)).toBeNull();
    expect(await getPhoto(photoIdOf(row.photos[0].src)!, NOW)).toBeNull();
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("deleted");
    // What buyers see changed, so the listings tag expires (amendment 10.7).
    expect(request.updatedTags).toEqual(["listings", "listings"]);
  });

  it("never touches another shop's listing", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(async () => saveListingForm(await fanForm({ listing: "l-004" })))).toBe("/sell/listings");
    await redirectOf(() => changeListingState(form({ listing: "l-004", to: "paused", tab: "available" })));
    await redirectOf(() => deleteListingForm(form({ listing: "l-004" })));
    expect(sampleStore().listings.get("l-004")).toMatchObject({
      title: "Box braids, shoulder length",
      state: "available",
    });
    expect(request.updatedTags).toEqual([]);
  });

  it("sends a signed-out visitor to sign in, and a student with no shop to /sell", async () => {
    expect(await redirectOf(async () => saveListingForm(await fanForm()))).toBe("/login?next=%2Fsell%2Flistings%2Fnew");
    await signedInAs("acc-student");
    expect(await redirectOf(async () => saveListingForm(await fanForm()))).toBe("/sell");
    expect(await redirectOf(() => changeListingState(form({ listing: "l-001", to: "paused", tab: "available" })))).toBe(
      "/sell",
    );
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("available");
  });
});

describe("telling followers (community actions spec 2.19, plan decision 15)", () => {
  const notes = async () =>
    (await getNotifications("acc-student", 50)).filter((item) => item.kind === "new-listing");

  it("tells followers about a first publish, and not about an edit", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect(await notes()).toMatchObject([{ text: "Tech corner listed Desk fan" }]);
    const row = (await fan())!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id, title: "Desk fan, quiet" })));
    expect(await notes()).toMatchObject([{ text: "Tech corner listed Desk fan" }]);
  });

  it("tells them when a draft is published, not when it's saved as one", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ intent: "draft" })));
    expect(await notes()).toEqual([]);
    const row = (await fan())!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id })));
    expect(await notes()).toHaveLength(1);
  });

  it("tells them once for a listing published, saved back as a draft and published again (plan amendment 1)", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    const row = (await fan())!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id, intent: "draft" })));
    // On a later SAST day, so a second notification couldn't be folded into the first day's one.
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id })));
    expect((await getOwnListing("tech-corner", row.id))?.state).toBe("available");
    expect(await notes()).toMatchObject([{ text: "Tech corner listed Desk fan" }]);
    expect(await notes()).toHaveLength(1);
  });

  it("stays quiet while the shop is paused", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect(await notes()).toEqual([]);
  });
});

describe("saved-search alerts (search alerts spec 2.9 and 2.10, plan decision 13)", () => {
  const FAN: MatchQuery = { q: "fan", category: null, campus: "midrand", price: null, pay: null, deals: null };
  const matches = async (accountId = "acc-student") =>
    (await getNotifications(accountId, 50)).filter((item) => item.kind === "search-match");

  it("tells a matching saved search about a first publish, naming the listing", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    const row = (await fan())!;
    expect(await matches()).toMatchObject([
      { text: "Desk fan matches your search “fan” at Midrand", href: `/listings/${row.id}` },
    ]);
  });

  it("tells it when a draft is published, not when it's saved as one", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ intent: "draft" })));
    expect(await matches()).toEqual([]);
    const row = (await fan())!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id })));
    expect(await matches()).toHaveLength(1);
  });

  it("tells it once for a listing published, saved back as a draft and published again (plan amendment 1)", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    const row = (await fan())!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id, intent: "draft" })));
    // On a later SAST day, so a second notification couldn't be folded into the first day's one.
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id })));
    expect((await getOwnListing("tech-corner", row.id))?.state).toBe("available");
    expect(await matches()).toHaveLength(1);
  });

  it("says nothing about an edit, even one that makes the listing match", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ title: "Desk cooler" })));
    await addSavedSearch("acc-student", FAN, NOW);
    const row = (await listOwnListings("tech-corner")).find((item) => item.title === "Desk cooler")!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id, title: "Desk fan" })));
    expect((await fan())?.id).toBe(row.id);
    expect(await matches()).toEqual([]);
  });

  it("says nothing about a relist, or a listing resumed", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    await addSavedSearch("acc-student", FAN, NOW);
    const row = (await fan())!;
    const move = (to: string, tab: string) => redirectOf(() => changeListingState(form({ listing: row.id, to, tab })));
    await move("sold", "available");
    await move("available", "sold");
    await move("paused", "available");
    await move("available", "paused");
    expect((await fan())?.state).toBe("available");
    expect(await matches()).toEqual([]);
  });

  it("stays quiet while the shop is paused, and when it resumes", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    await redirectOf(() => resumeShop());
    expect(sampleStore().sellerProfiles.get("acc-seller")?.status).toBe("approved");
    expect(await matches()).toEqual([]);
  });

  it("never tells the shop's own owner, or a paused search", async () => {
    await addSavedSearch("acc-seller", FAN, NOW);
    await addSavedSearch("acc-student", FAN, NOW);
    const [saved] = await listSavedSearches("acc-student");
    await setSavedSearchPaused("acc-student", saved.id, true, NOW);
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect(await matches("acc-seller")).toEqual([]);
    expect(await matches()).toEqual([]);
  });
});

describe("the paused shop's notice (C2/C3 plan decision 8)", () => {
  it("comes from the owner's own shop, not the Hub's tools", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("lib/selling/listing-actions.ts", "utf8");
    // Written in two parts, so the plan's Task 11 grep for the name over lib/selling finds nothing.
    expect(source).not.toContain(["shop", "Standing"].join(""));
    expect(source).not.toContain("@/lib/data/staff-shops");
    expect(source).toContain("owner.pausedByHub");
  });
});

describe("filling in from a photo (photo-to-listing spec 2.3, 2.4 and decisions 1 to 6, 12)", () => {
  const suggestion = {
    title: FAKE_REPLY.title,
    categorySlug: FAKE_REPLY.categorySlug,
    condition: FAKE_REPLY.condition,
    description: FAKE_REPLY.description,
    alt: FAKE_REPLY.alt,
    moduleCode: FAKE_REPLY.moduleCode,
  };
  const suggestForm = async (overrides: Record<string, string | string[] | File | File[]> = {}) =>
    form({
      once: await freshToken(),
      kind: "item",
      title: "",
      category: "",
      condition: "",
      description: "",
      payMode: "cash",
      handover: "pickup",
      pickup: "pp-midrand-library",
      intent: "suggest",
      newPhotos: photoFile(pngBytes()),
      ...overrides,
    });

  beforeEach(() => {
    vi.stubEnv("VOSSIE_LISTING_AI", "1");
    vi.stubEnv("VOSSIE_LISTING_AI_PROVIDERS", "fake");
    vi.mocked(readCoverPhoto).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fills the empty fields, tags them, keeps the photo, makes no listing and comes back to the form", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readCoverPhoto).mockResolvedValue({ ok: true, suggestion });
    const listingsBefore = (await listOwnListings("tech-corner")).length;
    expect(await redirectOf(async () => saveListingForm(await suggestForm({ title: "My calculator" })))).toBe(
      "/sell/listings/new",
    );
    const state = (await readFormState(listingForm(null)))!;
    expect(state.notice).toBe("suggested");
    expect(state.values).toMatchObject({
      title: "My calculator",
      category: "textbooks-notes",
      condition: "good",
      description: `Module FAC1501. ${FAKE_REPLY.description}`,
      suggestedModule: "FAC1501",
    });
    expect(state.values.suggested.split(" ")).toEqual(["category", "condition", "description", expect.stringMatching(/^alt:/)]);
    expect(state.values.photos).not.toBe("");
    expect(await listOwnListings("tech-corner")).toHaveLength(listingsBefore);
  });

  it("answers without a photo, a person and a failure with their notices, the form unchanged", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await suggestForm({ newPhotos: [] })));
    expect((await readFormState(listingForm(null)))?.notice).toBe("suggest-no-photo");
    expect(readCoverPhoto).not.toHaveBeenCalled();

    vi.mocked(readCoverPhoto).mockResolvedValueOnce({ ok: false, failure: "person" });
    await redirectOf(async () => saveListingForm(await suggestForm({ title: "Kept" })));
    expect(await readFormState(listingForm(null))).toMatchObject({ notice: "suggest-person", values: { title: "Kept" } });

    vi.mocked(readCoverPhoto).mockResolvedValueOnce({ ok: false, failure: "timeout" });
    await redirectOf(async () => saveListingForm(await suggestForm()));
    const failed = (await readFormState(listingForm(null)))!;
    expect(failed.notice).toBe("suggest-failed");
    expect(failed.values.suggested).toBeUndefined();
  });

  it("says everything was filled already, rather than 0 fields, and still counts the press", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readCoverPhoto).mockResolvedValueOnce({ ok: true, suggestion });
    const full = {
      title: "My calculator",
      category: "tech",
      condition: "good",
      description: "Works well.",
      photo: "new:0",
      "alt:new:0": "The calculator from the front",
    };
    await redirectOf(async () => saveListingForm(await suggestForm(full)));
    const state = (await readFormState(listingForm(null)))!;
    expect(state.notice).toBe("suggest-nothing");
    expect(state.values).toMatchObject({ title: "My calculator", description: "Works well." });
    expect(state.values.suggested).toBeUndefined();
    expect(readCoverPhoto).toHaveBeenCalledTimes(1);
  });

  it("keeps the form when the suggest path itself fails, logging only the kind", async () => {
    await signedInAs("acc-seller");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readCoverPhoto).mockRejectedValueOnce(new Error("rpc failed for own-shop@eduvos.com"));
    expect(await redirectOf(async () => saveListingForm(await suggestForm({ title: "Typed and kept" })))).toBe(
      "/sell/listings/new",
    );
    const state = (await readFormState(listingForm(null)))!;
    expect(state).toMatchObject({ notice: "suggest-failed", values: { title: "Typed and kept" } });
    expect(state.values.photos).not.toBe("");
    expect(warn).toHaveBeenCalledWith("[vossie] photo-to-listing: suggest error");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("eduvos.com");
    warn.mockRestore();
  });

  it("serves no fill on an edit form, even a forged one (decision 4)", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readCoverPhoto).mockResolvedValue({ ok: true, suggestion });
    const forged = await suggestForm({ listing: "l-001", photo: COVER, newPhotos: [] });
    expect(await redirectOf(async () => saveListingForm(forged))).toBe("/sell/listings/l-001/edit");
    expect(readCoverPhoto).not.toHaveBeenCalled();
    expect((await readFormState(listingForm("l-001")))?.notice ?? null).toBeNull();
  });

  it("stops at the day's limit, counting only presses that reach a provider", async () => {
    // The five sample accounts are exempt in sample mode (decision 12), so this one stands in for a student's own.
    sampleStore().accounts.get("acc-pending")!.email = "own-shop@eduvos.com";
    await signedInAs("acc-pending");
    vi.mocked(readCoverPhoto).mockResolvedValue({ ok: true, suggestion });
    for (let i = 0; i < 20; i += 1) await redirectOf(async () => saveListingForm(await suggestForm({ pickup: "pp-pretoria-library" })));
    expect(readCoverPhoto).toHaveBeenCalledTimes(20);
    await redirectOf(async () => saveListingForm(await suggestForm({ pickup: "pp-pretoria-library" })));
    expect(readCoverPhoto).toHaveBeenCalledTimes(20);
    expect((await readFormState(listingForm(null)))?.notice).toBe("suggest-limit");
  });

  it("does nothing new while the feature is off: the press saves nothing and says nothing", async () => {
    vi.stubEnv("VOSSIE_LISTING_AI", "");
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await suggestForm()));
    expect(readCoverPhoto).not.toHaveBeenCalled();
    expect((await readFormState(listingForm(null)))?.notice ?? null).toBeNull();
  });
});
