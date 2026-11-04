import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { readSearchPhoto } from "@/lib/data/ai";
import { reservePhotoSearch } from "@/lib/data/photo-searches";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { ascii, containsText, GPS, jpegBytes } from "@/tests/helpers/image-bytes";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { PHOTO_SEARCH_FORM, PHOTO_SEARCHES_PER_DAY } from "./photo";
import { searchByPhoto } from "./photo-actions";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/ai", () => ({ readSearchPhoto: vi.fn() }));

const NOW = new Date("2026-11-05T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-12-05T08:42:00.000Z");
const ANSWER = { words: ["casio", "calculator"], categorySlug: "tech", moduleCode: null, confidence: "high" as const };

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("VOSSIE_AI_PHOTO_SEARCH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  vi.mocked(readSearchPhoto).mockReset().mockResolvedValue({ ok: true, answer: ANSWER });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function signedInAs(accountId: string) {
  await createSession({ key: hashToken("token-1"), accountId, createdAt: NOW, expiresAt: IN_30_DAYS });
  request.cookies.set(SESSION_COOKIE, "token-1");
}

/** A student who isn't one of the five fixtures, so the daily count applies even in sample mode. */
async function signedInAsRealStudent() {
  sampleStore().accounts.get("acc-student")!.email = "thandi@eduvos.com";
  await signedInAs("acc-student");
}

function photoForm(file?: File): FormData {
  const data = new FormData();
  if (file) data.append("photo", file);
  return data;
}

const jpeg = (bytes: Uint8Array<ArrayBuffer> = jpegBytes()) => new File([bytes], "photo.jpg", { type: "image/jpeg" });
const notice = async () => (await readFormState(PHOTO_SEARCH_FORM))?.notice ?? null;

describe("searching with a photo (AI features spec section 5)", () => {
  it("does nothing while the switch is off", async () => {
    vi.stubEnv("VOSSIE_AI_PHOTO_SEARCH", "");
    await signedInAs("acc-student");
    await expect(searchByPhoto(photoForm(jpeg()))).rejects.toThrow("notFound");
    expect(readSearchPhoto).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in, back to the photo search", async () => {
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/login?next=%2Fbrowse%2Fphoto");
    expect(readSearchPhoto).not.toHaveBeenCalled();
  });

  it("falls back to the plain name when every word together finds nothing", async () => {
    vi.mocked(readSearchPhoto).mockResolvedValue({ ok: true, answer: { ...ANSWER, words: ["calculator", "12", "digit"] } });
    await signedInAs("acc-student");
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse?q=calculator&cat=tech");
  });

  it("keeps every word when they find something together, and a single word as it is", async () => {
    await signedInAs("acc-student");
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse?q=casio+calculator&cat=tech");
    vi.mocked(readSearchPhoto).mockResolvedValue({ ok: true, answer: { ...ANSWER, words: ["theodolite"] } });
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse?q=theodolite&cat=tech");
  });

  it("lands on Browse with the model's words, writing no form state (spec 5.3)", async () => {
    await signedInAs("acc-student");
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse?q=casio+calculator&cat=tech");
    expect(await notice()).toBeNull();
  });

  it("sends the photo stripped of its hidden data, with the categories, and stores nothing (spec 5.1)", async () => {
    await signedInAs("acc-student");
    const photosBefore = sampleStore().photos.size;
    await redirectOf(() => searchByPhoto(photoForm(jpeg(jpegBytes({ exif: true, comment: true })))));
    const [photo, categories] = vi.mocked(readSearchPhoto).mock.calls[0]!;
    expect(photo.type).toBe("image/jpeg");
    expect(containsText(photo.bytes, GPS)).toBe(false);
    expect(categories.map((category) => category.slug)).toContain("tech");
    expect(sampleStore().photos.size).toBe(photosBefore);
  });

  it("goes back with a notice when there's no photo, or one it can't use, without counting it", async () => {
    await signedInAsRealStudent();
    expect(await redirectOf(() => searchByPhoto(photoForm()))).toBe("/browse/photo");
    expect(await notice()).toBe("no-photo");
    await redirectOf(() => searchByPhoto(photoForm(new File([], "empty.jpg", { type: "image/jpeg" }))));
    expect(await notice()).toBe("no-photo");
    await redirectOf(() => searchByPhoto(photoForm(new File([ascii("hello")], "notes.txt", { type: "text/plain" }))));
    expect(await notice()).toBe("photo-type");
    await redirectOf(() => searchByPhoto(photoForm(new File([new Uint8Array(5 * 1024 * 1024)], "big.jpg"))));
    expect(await notice()).toBe("photo-size");
    expect(readSearchPhoto).not.toHaveBeenCalled();
    expect(sampleStore().photoSearches.has("acc-student")).toBe(false);
  });

  it("a person or low confidence is 'couldn't tell'; a provider's failure is 'failed'", async () => {
    await signedInAs("acc-student");
    vi.mocked(readSearchPhoto).mockResolvedValueOnce({ ok: false, failure: "person" });
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse/photo");
    expect(await notice()).toBe("cant-tell");
    vi.mocked(readSearchPhoto).mockResolvedValueOnce({ ok: false, failure: "low-confidence" });
    await redirectOf(() => searchByPhoto(photoForm(jpeg())));
    expect(await notice()).toBe("cant-tell");
    vi.mocked(readSearchPhoto).mockResolvedValueOnce({ ok: false, failure: "timeout" });
    await redirectOf(() => searchByPhoto(photoForm(jpeg())));
    expect(await notice()).toBe("failed");
  });

  it("anything thrown is 'failed', logging only the kind", async () => {
    await signedInAs("acc-student");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readSearchPhoto).mockRejectedValueOnce(new Error("casio calculator"));
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse/photo");
    expect(await notice()).toBe("failed");
    expect(warn.mock.calls).toEqual([["[vossie] photo-search: search error"]]);
  });

  it(`allows ${PHOTO_SEARCHES_PER_DAY} searches a day, then says so without asking the model (spec 5.4)`, async () => {
    await signedInAsRealStudent();
    for (let i = 1; i < PHOTO_SEARCHES_PER_DAY; i += 1) await reservePhotoSearch("acc-student", NOW, PHOTO_SEARCHES_PER_DAY);
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse?q=casio+calculator&cat=tech");
    expect(await redirectOf(() => searchByPhoto(photoForm(jpeg())))).toBe("/browse/photo");
    expect(await notice()).toBe("limit");
    expect(readSearchPhoto).toHaveBeenCalledTimes(1);
  });

  it("doesn't count a sample account's searches in sample mode", async () => {
    await signedInAs("acc-student");
    await redirectOf(() => searchByPhoto(photoForm(jpeg())));
    expect(sampleStore().photoSearches.has("acc-student")).toBe(false);
  });

  it("never stores the photo: the action doesn't reach the photo store", () => {
    const source = readFileSync(join(process.cwd(), "lib/search/photo-actions.ts"), "utf8");
    expect(source).not.toMatch(/storePhotos|from "@\/lib\/data\/photos"/);
  });
});
