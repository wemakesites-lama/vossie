import type { HubBanner, HubPost, HubPostKind } from "@/lib/types";

export const hubBanner: HubBanner = {
  image: { src: "/placeholders/hub/banner.svg", alt: "" },
};

/** A post's body, one line per argument (the markdown subset, community spec decision 9). */
const lines = (...text: string[]): string => text.join("\n");

type Words = { summary: string; body: string };

/** When and where. Events start at 18:00 in South Africa (16:00 UTC), office hours at 13:00 (11:00 UTC). */
type When = { startsAt: string; place: string };

const post = (
  id: string,
  kind: HubPostKind,
  title: string,
  campusSlug: string,
  publishedAt: string,
  details: Pick<HubPost, "startsAt" | "place" | "capacity" | "going">,
  { summary, body }: Words,
): HubPost => ({
  id,
  kind,
  title,
  campusSlug,
  publishedAt,
  ...details,
  summary,
  body,
  image: { src: `/placeholders/hub/${id}.svg`, alt: "" },
});

const event = (
  id: string,
  title: string,
  campusSlug: string,
  publishedAt: string,
  { startsAt, place }: When,
  places: { capacity: number; going: number },
  words: Words,
): HubPost => post(id, "event", title, campusSlug, publishedAt, { startsAt, place, ...places }, words);

const officeHours = (
  id: string,
  title: string,
  campusSlug: string,
  publishedAt: string,
  { startsAt, place }: When,
  words: Words,
): HubPost =>
  post(id, "office-hours", title, campusSlug, publishedAt, { startsAt, place, capacity: null, going: null }, words);

const tip = (id: string, title: string, publishedAt: string, words: Words): HubPost =>
  post(id, "tip", title, "all", publishedAt, { startsAt: null, place: null, capacity: null, going: null }, words);

// The Incubation Hub's posts (community spec 5.3). h-001 to h-010 are the homepage's 10 events, with the same titles,
// campuses and dates; "Photo day for your shop" is booked, so it's office hours. h-011 and h-012 are past, so "has
// passed" can be tested on any date (plan decision 2). The wording is sample text for the Hub to change.
export const hubPosts: readonly HubPost[] = [
  event(
    "h-001", "Pitch night", "all", "2026-09-30T08:00:00Z",
    { startsAt: "2026-10-14T16:00:00Z", place: "Online, with a watch party at every Hub" },
    { capacity: 80, going: 12 },
    {
      summary: "Five student businesses pitch to Hub mentors, and the room votes for a crowd favourite.",
      body: lines(
        "Five student businesses pitch to a panel of Incubation Hub mentors. Each team gets five minutes to pitch " +
          "and three minutes for questions.",
        "",
        "## How the night runs",
        "1. Doors open at 17:30 at your campus's Hub, or join online.",
        "2. Pitches start at 18:00.",
        "3. Everyone votes for a crowd favourite before the panel announces its pick.",
        "",
        "Come to cheer, to learn, or to see what it takes. **Want to pitch next time?** Start with " +
          "[how to get the Verified badge](/hub/h-017), then talk to the Hub on your campus.",
      ),
    },
  ),
  officeHours(
    "h-002", "Office hours: pricing your hustle", "midrand", "2026-10-01T08:00:00Z",
    { startsAt: "2026-10-15T11:00:00Z", place: "The Hub, Block C" },
    {
      summary: "Bring your price list and a mentor will check it against your costs and what students pay.",
      body: lines(
        "Not sure if you're charging too much or too little? Bring your price list, or just your costs, and a mentor " +
          "will work through it with you.",
        "",
        "## Bring",
        "- What it costs you to make or deliver one item or session",
        "- Your prices now, if you have them",
        "- Two or three listings like yours on CampusCart",
        "",
        "Slots are 20 minutes. Read [how to price your first listing](/hub/h-013) before you come.",
      ),
    },
  ),
  event(
    "h-003", "Market day on the lawn", "pretoria", "2026-10-02T08:00:00Z",
    { startsAt: "2026-10-20T16:00:00Z", place: "The lawn outside the library" },
    { capacity: 40, going: 23 },
    {
      summary: "An evening market for student sellers on the library lawn: come to buy, or bring your stock and sell.",
      body: lines(
        "Student sellers set up on the lawn outside the library for an evening market. Come and buy, or bring your " +
          "own stock and sell.",
        "",
        "## For sellers",
        "- Stalls are free, and Verified sellers choose their spot first.",
        "- Bring a table if you can. The Hub has ten to lend.",
        "- Card machines work best on mobile data: the Wi-Fi on the lawn is patchy.",
        "",
        "Read [meeting a buyer safely on campus](/hub/h-015) for the basics on cash and handovers.",
      ),
    },
  ),
  officeHours(
    "h-004", "Photo day for your shop", "bedfordview", "2026-10-05T08:00:00Z",
    { startsAt: "2026-10-22T11:00:00Z", place: "Studio room, Block A" },
    {
      summary: "Book 15 minutes in the studio room and leave with photos of your products or your work.",
      body: lines(
        "A Hub mentor sets up a light box and a plain backdrop in the studio room. Book a slot, bring up to five " +
          "items or examples of your work, and leave with photos you can use on CampusCart.",
        "",
        "- Clean your items first: dust shows up on camera.",
        "- Selling a service? Bring something that shows your work, like a finished set of nails or a printed logo.",
        "",
        "Can't make it? Try [five phone tricks for better photos](/hub/h-014).",
      ),
    },
  ),
  event(
    "h-005", "Hub mixer", "all", "2026-10-07T08:00:00Z",
    { startsAt: "2026-10-28T16:00:00Z", place: "The Hub on every campus" },
    { capacity: 120, going: 45 },
    {
      summary: "Meet other student sellers and the Hub's mentors over snacks at your campus's Hub.",
      body: lines(
        "An evening to meet other student sellers, swap ideas and put faces to the mentors. Every campus's Hub hosts " +
          "its own, with snacks from student food sellers.",
        "",
        "No pitch and no slides. Just bring yourself and, if you like, a few business cards.",
      ),
    },
  ),
  event(
    "h-006", "Selling online: photos that sell", "all", "2026-10-08T08:00:00Z",
    { startsAt: "2026-11-05T16:00:00Z", place: "Online" },
    { capacity: 200, going: 64 },
    {
      summary: "A one-hour online workshop on taking listing photos with nothing but your phone.",
      body: lines(
        "A one-hour workshop on taking photos that make people stop scrolling. All you need is your phone.",
        "",
        "## What we'll cover",
        "1. Light: where to stand, and why a window beats a flash.",
        "2. Background: plain, tidy and the same every time.",
        "3. The first photo: the one buyers see in the grid.",
        "",
        "There's time for questions at the end. Send in a photo you're unsure about when you RSVP, and we may use it " +
          "as an example.",
      ),
    },
  ),
  officeHours(
    "h-007", "Office hours: your first listing", "midrand", "2026-10-09T08:00:00Z",
    { startsAt: "2026-11-19T11:00:00Z", place: "The Hub, Block C" },
    {
      summary: "Sit with a mentor and put your first listing on CampusCart, from the title to the photos.",
      body: lines(
        "Never listed anything before? Bring your phone and the thing you want to sell, and a mentor will help you " +
          "list it in one sitting.",
        "",
        "We'll go through the title, the price, the photos and how buyers will reach you. Read " +
          "[writing a listing people trust](/hub/h-016) first if you have time.",
      ),
    },
  ),
  event(
    "h-008", "End-of-year market", "all", "2026-10-10T08:00:00Z",
    { startsAt: "2026-12-03T16:00:00Z", place: "By the student centre on every campus" },
    { capacity: 60, going: 18 },
    {
      summary: "The last market of the year, on every campus: clear out, stock up or find a gift.",
      body: lines(
        "The last market of the year, on every campus at once. Students clearing out res sell what they don't want " +
          "to carry home, and student businesses sell gifts and food.",
        "",
        "- Stalls are free for students.",
        "- Free items go on the giveaway table.",
        "- Anything left at the end can go in the Hub's donation box.",
      ),
    },
  ),
  event(
    "h-009", "Back-to-campus pop-up", "pretoria", "2026-10-11T08:00:00Z",
    { startsAt: "2027-01-28T16:00:00Z", place: "Student centre foyer" },
    { capacity: 50, going: 6 },
    {
      summary: "A pop-up for the first week back: second-hand textbooks, res kit and student services in one place.",
      body: lines(
        "A pop-up for the first week back, in the student centre foyer. Second-hand textbooks, res kit and student " +
          "services, all in one place.",
        "",
        "Selling? Stalls go to Verified sellers first, then everyone else. **Buying?** Bring your module list, so " +
          "you know which editions you need.",
      ),
    },
  ),
  event(
    "h-010", "Pitch night", "all", "2026-10-12T08:00:00Z",
    { startsAt: "2027-02-11T16:00:00Z", place: "Online, with a watch party at every Hub" },
    { capacity: 80, going: 3 },
    {
      summary: "The first pitch night of 2027: five new student businesses, one panel and a crowd favourite.",
      body: lines(
        "The first pitch night of the year. Five new student businesses pitch to a panel of Incubation Hub mentors, " +
          "and the room votes for a crowd favourite.",
        "",
        "Applications to pitch open in January. Start with [how to get the Verified badge](/hub/h-017).",
      ),
    },
  ),
  event(
    "h-011", "Hub open day", "all", "2026-09-01T08:00:00Z",
    { startsAt: "2026-09-16T16:00:00Z", place: "The Hub on every campus" },
    { capacity: 150, going: 96 },
    {
      summary: "An open day at every campus's Hub: meet the mentors and see what the Hub can do for your business.",
      body: lines(
        "Every campus's Hub opened its doors for the evening. Students met the mentors, heard how CampusCart works and " +
          "booked their first office hours.",
        "",
        "Missed it? The Hub runs [office hours](/hub?type=office-hours) through the year.",
      ),
    },
  ),
  officeHours(
    "h-012", "Office hours: registering your business", "midrand", "2026-09-10T08:00:00Z",
    { startsAt: "2026-09-24T11:00:00Z", place: "The Hub, Block C" },
    {
      summary: "A mentor walks you through registering a small business, step by step.",
      body: lines(
        "Thinking of registering your business? A mentor will walk you through the steps, what it costs and what " +
          "to have ready.",
        "",
        "- Your ID and proof of address",
        "- A name for your business, and two back-ups",
        "- A rough idea of what you'll sell",
      ),
    },
  ),
  tip("h-013", "How to price your first listing", "2026-10-12T07:00:00Z", {
    summary: "Start from what's already listed, add up your costs, and leave room to say yes to a fair offer.",
    body: lines(
      "Pricing is the first thing buyers look at, and the easiest thing to get wrong. Start with what's already out " +
        "there, then check it against your own costs.",
      "",
      "## Start from what's out there",
      "1. Search CampusCart for the same thing, or [browse what's already listed](/browse).",
      "2. Note the lowest and highest prices for the same condition.",
      "3. Price yours somewhere in between, and say why in the description.",
      "",
      "## Check your costs",
      "For food, services and anything you make, add up what one item or session costs you: ingredients, data, " +
        "transport and your time. If the market price doesn't cover it, **don't go lower**. Change what you offer " +
        "instead.",
      "",
      "## Leave room for a fair offer",
      "Students like to ask for a little off. If you'd take R250, a price of R270 lets you say yes. " +
        "*Firm prices are fine too*, as long as the listing says so.",
    ),
  }),
  tip("h-014", "Five phone tricks for better photos", "2026-10-09T07:00:00Z", {
    summary: "Daylight, a plain background and a clean lens do more for a listing than any filter.",
    body: lines(
      "Buyers decide in a second, and they decide on the first photo. You don't need a good camera, just these five " +
        "habits.",
      "",
      "1. **Use daylight.** Stand near a window, and turn the flash off.",
      "2. **Clear the background.** A plain wall, a sheet or a desk with nothing else on it.",
      "3. **Wipe the lens.** Phones live in pockets, and a smudge makes everything look old.",
      "4. **Show the whole thing first,** then the details: labels, scratches, the size tag.",
      "5. **Shoot straight on.** Hold the phone at the same height as the item.",
      "",
      "Want help in person? Book a slot on [photo day for your shop](/hub/h-004).",
    ),
  }),
  tip("h-015", "Meeting a buyer safely on campus", "2026-10-06T07:00:00Z", {
    summary: "Meet in a busy place on campus, in daylight, and check the item before any money moves.",
    body: lines(
      "Most sales on CampusCart end with a handover on campus. A few habits keep them easy and safe.",
      "",
      "## Before you meet",
      "- Agree on the price and the place in your messages, so there are no surprises.",
      "- Pick a busy spot on campus, like the library entrance, during the day.",
      "- Tell a friend where you're going.",
      "",
      "## At the handover",
      "- Let the buyer check the item before they pay.",
      "- For cash, count it there and then. For a transfer, wait until it shows in your account.",
      "- If something feels wrong, walk away. There will be other buyers.",
      "",
      "Read CampusCart's [safety tips](/safety) for more.",
    ),
  }),
  tip("h-016", "Writing a listing people trust", "2026-10-01T07:00:00Z", {
    summary: "Say what it is, what condition it's in and how the handover works, in plain words.",
    body: lines(
      "A clear listing gets fewer questions and sells sooner. Write it the way you'd describe the item to a friend.",
      "",
      "## The title",
      "Say what it is, then what makes it different: “Casio calculator, exam approved” beats " +
        "“Calculator for sale”.",
      "",
      "## The description",
      "- What's included, and what isn't.",
      "- The condition, honestly, with any marks or faults.",
      "- Where and when you can hand it over.",
      "",
      "*Tip:* if a buyer asks the same question twice, add the answer to the listing. When you're ready, " +
        "[start selling](/sell).",
    ),
  }),
  tip("h-017", "How to get the Verified badge", "2026-09-25T07:00:00Z", {
    summary: "Verified means the Hub has met you and checked your business. Here's how to apply.",
    body: lines(
      "The Verified badge tells buyers the Incubation Hub has met you and checked your business. It's free, and it " +
        "takes about a week.",
      "",
      "## How it works",
      "1. Sell on CampusCart for at least a month.",
      "2. Book [office hours](/hub?type=office-hours) and tell the mentor you'd like to be verified.",
      "3. Bring your ID and examples of your work. The mentor checks them with you.",
      "4. Once you're verified, the badge shows on your shop and your listings.",
      "",
      "The Hub can take the badge away if a seller stops keeping their promises to buyers.",
    ),
  }),
  tip("h-018", "From side hustle to small business", "2026-09-18T07:00:00Z", {
    summary: "Three signs your hustle is ready to grow, and what to do about each one.",
    body: lines(
      "Plenty of student businesses start as a favour for a friend. Here are three signs yours is ready for more.",
      "",
      "## You're turning people away",
      "If you're fully booked most weeks, it's time to raise your prices or find someone to help.",
      "",
      "## People ask the same questions",
      "Write the answers into your listings and your shop's About, so you can spend the time on the work.",
      "",
      "## You're not sure where the money goes",
      "Keep a simple record of what comes in and what goes out, every week. A mentor can show you how in " +
        "[office hours](/hub?type=office-hours).",
    ),
  }),
];
