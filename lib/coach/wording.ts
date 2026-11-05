import { clipAtWord } from "@/lib/clip";
import { TITLE_MAX, WHY_MAX, type CoachKind } from "./kinds";
import type { Candidate } from "./types";

// Shop coach's fixed wording (AI round two spec 4): every kind's template, filled from its evidence and the target's
// name. Used when the model fails, when the batch is late, and always in sample mode. Samples for Lama to change.

type Words = { title: string; why: string };
const n = (c: Candidate, key: string) => c.evidence[key] ?? 0;
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const TEMPLATES: Readonly<Record<CoachKind, (c: Candidate) => Words>> = {
  "reply-waiting": (c) => ({
    title: n(c, "waiting") === 1 ? "Reply to the student waiting on you" : `Reply to the ${n(c, "waiting")} students waiting on you`,
    why: `Your oldest enquiry is ${n(c, "oldestDays")} ${plural(n(c, "oldestDays"), "day", "days")} old.`,
  }),
  "mark-sold": (c) => ({
    title: n(c, "sales") === 1 ? "Mark your sale as sold" : `Mark your ${n(c, "sales")} sales as sold`,
    why: "A buyer finished the deal, but buyers still see it as available.",
  }),
  "add-photos": (c) => ({
    title: `Add a second photo to ${c.name}`,
    why: n(c, "photos") === 0 ? "It has no photo yet. Buyers ask more about listings with a few." : "It has 1 photo. Buyers ask more about listings with a few.",
  }),
  "say-more": (c) => ({
    title: `Say more about ${c.name}`,
    why: `Its description is ${n(c, "chars")} characters. Size, condition and where to meet help buyers decide.`,
  }),
  "refresh-quiet": (c) => ({
    title: `Refresh ${c.name}`,
    why: `No one has asked about it in ${n(c, "days")} days. A new photo, title or price can help.`,
  }),
  "check-price": (c) => ({
    title: `Check the price of ${c.name}`,
    why: `${n(c, "similar")} similar listings ask about R${n(c, "middle")}; yours is R${n(c, "price")}.`,
  }),
  "answer-request": (c) => ({
    title: `Make an offer: ${c.name}`,
    why: "A student at your campus is looking for something like what you sell.",
  }),
  "list-more": (c) => ({
    title: n(c, "more") === 1 ? "List one more thing" : `List ${n(c, "more")} more things`,
    why: `You have ${n(c, "available")} available ${plural(n(c, "available"), "listing", "listings")}. More choice gives buyers a reason to look around.`,
  }),
  "finish-shop": (c) => ({
    title: n(c, "photo") === 0 && n(c, "about") === 0 ? "Add a photo and a few words to your shop" : n(c, "photo") === 0 ? "Add a photo of your shop" : "Say what your shop is about",
    why: "Buyers trust a shop with a photo and a few words about it.",
  }),
  "go-to-launchpad": (c) => ({
    title: `Go to ${c.name}`,
    why: n(c, "days") === 0 ? "It's today, at your campus or online." : `It's in ${n(c, "days")} ${plural(n(c, "days"), "day", "days")}, at your campus or online.`,
  }),
  "read-tip": (c) => ({ title: `Read: ${c.name}`, why: "A short tip from the Hub's mentors." }),
};

export function fixedWording(candidate: Candidate): Words {
  const words = TEMPLATES[candidate.kind](candidate);
  return { title: clipAtWord(words.title, TITLE_MAX), why: clipAtWord(words.why, WHY_MAX) };
}
