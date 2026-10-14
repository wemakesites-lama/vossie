import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { getOwnListing, listOwnListings, setOwnListingState } from "@/lib/data/own-listings";
import { getPhoto, photoIdOf, storePhotos } from "@/lib/data/photos";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { ascii, containsText, GPS, pngBytes } from "@/tests/helpers/image-bytes";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { listingForm, MY_LISTINGS_FORM } from "./form-state";
import { changeListingState, deleteListingForm, saveListingForm } from "./listing-actions";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

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

/** A good listing form for Tech corner: a desk fan at the library, to publish. */
const fanForm = (overrides: Record<string, string | string[] | File | File[]> = {}) =>
  form({
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
    const redirect = await redirectSignalOf(() => saveListingForm(fanForm()));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sell/listings", "replace", true]);
    const row = (await fan())!;
    expect(row).toMatchObject({ state: "available", priceZar: 150, campusSlug: "midrand", photos: [] });
    expect(request.updatedTags).toEqual(["listings"]);
    expect(await readFormState(MY_LISTINGS_FORM)).toMatchObject({ notice: "published", values: { listing: row.id } });
  });

  it("saves a draft, and a waiting shop's Save and publish as a draft too", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(() => saveListingForm(fanForm({ intent: "draft" })))).toBe("/sell/listings?tab=drafts");
    expect((await fan())?.state).toBe("draft");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("drafted");
    await signedInAs("acc-pending");
    await redirectOf(() => saveListingForm(fanForm({ pickup: "pp-pretoria-library" })));
    expect((await listOwnListings("crochet-corner"))[0]).toMatchObject({ title: "Desk fan", state: "draft" });
  });

  it("keeps everything typed, the errors and the uploaded photo when a save fails", async () => {
    await signedInAs("acc-seller");
    const failing = fanForm({ title: "", price: "lots", newPhotos: photoFile(pngBytes()) });
    expect(await redirectOf(() => saveListingForm(failing))).toBe("/sell/listings/new");
    const state = (await readFormState(listingForm(null)))!;
    expect(state.errors).toEqual(["title-missing", "price-invalid"]);
    expect(state.values).toMatchObject({ title: "", price: "lots", category: "res-living" });
    expect(state.values.photos).toMatch(/^\/photos\/ph-/);
    expect(await getPhoto(photoIdOf(state.values.photos)!)).not.toBeNull();
    expect(await fan()).toBeUndefined();
  });

  it("strips each upload, puts the photos in the order posted, and keeps each one's description", async () => {
    await signedInAs("acc-seller");
    const posted = fanForm({
      photo: ["new:1", "new:0"],
      newPhotos: [photoFile(pngBytes({ exif: true }), "back.png"), photoFile(pngBytes({ text: true }), "front.png")],
      "alt:new:1": " The fan from the front ",
    });
    await redirectOf(() => saveListingForm(posted));
    const [front, back] = (await fan())!.photos;
    expect([front.alt, back.alt]).toEqual(["The fan from the front", ""]);
    for (const photo of [front, back]) {
      expect(containsText((await getPhoto(photoIdOf(photo.src)!))!.bytes, GPS)).toBe(false);
    }
  });

  it("moves a photo without saving the listing, keeping what was typed, and comes back to the photos", async () => {
    await signedInAs("acc-seller");
    const moving = fanForm({
      listing: "l-001",
      title: "Typed but not saved",
      photo: [COVER, BACK, CASE],
      photoMove: `${CASE}:cover`,
    });
    expect(await redirectOf(() => saveListingForm(moving))).toBe("/sell/listings/l-001/edit#edit-l-001-photos");
    const state = (await readFormState(listingForm("l-001")))!;
    expect(state.values).toMatchObject({ title: "Typed but not saved", photos: [CASE, COVER, BACK].join("\n") });
    expect((await getOwnListing("tech-corner", "l-001"))?.title).toBe("Casio fx-991ZA Plus calculator");
    expect(request.updatedTags).toEqual([]);
  });

  it("refuses a file that isn't a photo, and photos past the sixth", async () => {
    await signedInAs("acc-seller");
    const files = [ascii("GIF89a"), pngBytes(), pngBytes(), pngBytes(), pngBytes()].map((bytes) => photoFile(bytes));
    await redirectOf(() => saveListingForm(fanForm({ listing: "l-001", photo: [COVER, BACK, CASE], newPhotos: files })));
    const state = (await readFormState(listingForm("l-001")))!;
    expect(state.errors).toEqual(["photo-type", "photo-count"]);
    expect(state.values.photos.split("\n")).toHaveLength(6);
  });

  it("drops photos that aren't the seller's own", async () => {
    const [theirs] = await storePhotos("acc-student", [{ type: "image/png", bytes: pngBytes() }], NOW);
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm({ photo: [theirs, "/placeholders/listing/food.svg"] })));
    expect((await fan())?.photos).toEqual([]);
  });

  it("saves changes to a listing, and keeps a sold one sold", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(() => saveListingForm(fanForm({ listing: "l-001", title: "Desk fan" })))).toBe(
      "/sell/listings",
    );
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("saved");
    await setOwnListingState("tech-corner", "l-001", "sold", NOW);
    expect(await redirectOf(() => saveListingForm(fanForm({ listing: "l-001" })))).toBe("/sell/listings?tab=sold");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("sold");
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

  it("deletes a listing and its photos, saying so", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm({ newPhotos: photoFile(pngBytes()) })));
    const row = (await fan())!;
    expect(await redirectOf(() => deleteListingForm(form({ listing: row.id })))).toBe("/sell/listings");
    expect(await getOwnListing("tech-corner", row.id)).toBeNull();
    expect(await getPhoto(photoIdOf(row.photos[0].src)!)).toBeNull();
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("deleted");
  });

  it("never touches another shop's listing", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(() => saveListingForm(fanForm({ listing: "l-004" })))).toBe("/sell/listings");
    await redirectOf(() => changeListingState(form({ listing: "l-004", to: "paused", tab: "available" })));
    await redirectOf(() => deleteListingForm(form({ listing: "l-004" })));
    expect(sampleStore().listings.get("l-004")).toMatchObject({
      title: "Box braids, shoulder length",
      state: "available",
    });
    expect(request.updatedTags).toEqual([]);
  });

  it("sends a signed-out visitor to sign in, and a student with no shop to /sell", async () => {
    expect(await redirectOf(() => saveListingForm(fanForm()))).toBe("/login?next=%2Fsell%2Flistings%2Fnew");
    await signedInAs("acc-student");
    expect(await redirectOf(() => saveListingForm(fanForm()))).toBe("/sell");
    expect(await redirectOf(() => changeListingState(form({ listing: "l-001", to: "paused", tab: "available" })))).toBe(
      "/sell",
    );
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("available");
  });
});
