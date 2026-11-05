import { describe, expect, it } from "vitest";
import { TITLE_MAX, WHY_MAX } from "./kinds";
import type { Candidate } from "./types";
import { fixedWording } from "./wording";

const cand = (kind: Candidate["kind"], name: string | null, evidence: Candidate["evidence"] = {}): Candidate => ({
  id: `${kind}:x`, kind, target: { type: "shop", id: null }, name, evidence, href: "/x",
});

describe("fixedWording (spec 4: every kind has a template)", () => {
  it("reply-waiting, singular and plural", () => {
    expect(fixedWording(cand("reply-waiting", null, { waiting: 1, oldestDays: 1 }))).toEqual({
      title: "Reply to the student waiting on you",
      why: "Your oldest enquiry is 1 day old.",
    });
    expect(fixedWording(cand("reply-waiting", null, { waiting: 3, oldestDays: 2 }))).toEqual({
      title: "Reply to the 3 students waiting on you",
      why: "Your oldest enquiry is 2 days old.",
    });
  });
  it("mark-sold", () => {
    expect(fixedWording(cand("mark-sold", null, { sales: 1 })).title).toBe("Mark your sale as sold");
    expect(fixedWording(cand("mark-sold", null, { sales: 2 })).title).toBe("Mark your 2 sales as sold");
  });
  it("add-photos, with none and with one", () => {
    expect(fixedWording(cand("add-photos", "Lamp", { photos: 0 }))).toMatchObject({ title: "Add a second photo to Lamp", why: expect.stringContaining("no photo") });
    expect(fixedWording(cand("add-photos", "Lamp", { photos: 1 })).why).toContain("1 photo");
  });
  it("cuts a long title to 70 characters at a word", () => {
    const { title } = fixedWording(cand("add-photos", "Casio fx-991ZA Plus scientific calculator with the hard case and manual", { photos: 1 }));
    expect(Array.from(title).length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title.endsWith("…")).toBe(true);
  });
  it("say-more, refresh-quiet, check-price", () => {
    expect(fixedWording(cand("say-more", "Lamp", { chars: 12 })).why).toContain("12 characters");
    expect(fixedWording(cand("refresh-quiet", "Lamp", { days: 30 }))).toMatchObject({ title: "Refresh Lamp", why: expect.stringContaining("30 days") });
    expect(fixedWording(cand("check-price", "Lamp", { similar: 3, middle: 250, price: 450 }))).toEqual({
      title: "Check the price of Lamp",
      why: "3 similar listings ask about R250; yours is R450.",
    });
  });
  it("answer-request and list-more", () => {
    expect(fixedWording(cand("answer-request", "Calculator")).title).toBe("Make an offer: Calculator");
    expect(fixedWording(cand("list-more", null, { available: 2, more: 1 })).title).toBe("List one more thing");
    expect(fixedWording(cand("list-more", null, { available: 0, more: 3 }))).toMatchObject({ title: "List 3 more things", why: expect.stringContaining("0 available listings") });
    expect(fixedWording(cand("list-more", null, { available: 1, more: 2 })).why).toContain("1 available listing.");
  });
  it("finish-shop in each combination", () => {
    expect(fixedWording(cand("finish-shop", null, { about: 0, photo: 0 })).title).toBe("Add a photo and a few words to your shop");
    expect(fixedWording(cand("finish-shop", null, { about: 1, photo: 0 })).title).toBe("Add a photo of your shop");
    expect(fixedWording(cand("finish-shop", null, { about: 0, photo: 1 })).title).toBe("Say what your shop is about");
  });
  it("go-to-launchpad and read-tip", () => {
    expect(fixedWording(cand("go-to-launchpad", "Pitch night", { days: 0 })).why).toBe("It's today, at your campus or online.");
    expect(fixedWording(cand("go-to-launchpad", "Pitch night", { days: 1 })).why).toBe("It's in 1 day, at your campus or online.");
    expect(fixedWording(cand("go-to-launchpad", "Pitch night", { days: 4 })).title).toBe("Go to Pitch night");
    expect(fixedWording(cand("read-tip", "Photos sell"))).toEqual({ title: "Read: Photos sell", why: "A short tip from the Hub's mentors." });
  });
  it("never exceeds the why limit", () => {
    expect(Array.from(fixedWording(cand("say-more", "x", { chars: 1 })).why).length).toBeLessThanOrEqual(WHY_MAX);
  });
});
