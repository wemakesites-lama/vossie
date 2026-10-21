# Vossie positioning and editorial: design spec

- **Date:** 2026-10-15
- **Status:** Draft for Lama's review. The brand line is Lama's choice (2026-10-15); every other decision below is Claude's recommendation. Eduvos marketing signs off the brand line before it goes live (section 12).
- **Scope:** what Vossie says it is, where it says it, and how it grows beyond buying and selling without losing that purpose: stories in the Hub now, and four later avenues that each wait on something outside the code. Phase 1 (the copy) is small enough to build straight from this spec; phase 2 (stories) gets its own plan once stage G's Hub post editor exists.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-08-homepage-design.md` | Tokens, the texture contrast rule, accessibility and budgets. Section 7.3 is the hero this spec keeps |
| `docs/superpowers/specs/2026-10-14-community-pages-design.md` | `HubPost`, the Hub feed and its tabs, and the markdown subset (decision 9) that stories extend |
| `docs/superpowers/specs/2026-10-14-staff-tools-design.md` | Section 4: the Hub's post editor, which gains the story kind |
| `docs/superpowers/specs/2026-10-14-selling-design.md` | Shop approval (decision 7), the claim the brand line rests on, and the `/sell` pitch |
| `docs/reference/LANDING-DECISIONS.md` | Decision 57 (in-app messages only) and decision 54 (Lama's standing goal) |

---

## 1. Goal

Today Vossie describes what it does ("Buy and sell textbooks, tech and services with students on your Eduvos campus") but not why a student would use it instead of Facebook Marketplace or a res WhatsApp group. The difference is already built: the Incubation Hub runs Vossie, checks every shop before it can list, and backs sellers with mentors, and handovers happen at approved campus pickup points.

This spec makes that difference the first thing people read. It also gives Vossie room to grow beyond buying and selling without turning into a social network or a news site.

## 2. Decisions this spec makes

1. **The brand line is "Your campus, open for business."** (Lama, 2026-10-15). It speaks to both sides: buyers shop their campus, sellers open a shop on it. The alternatives are kept in section 3.2.
2. **"Marketplace" stays as the plain noun.** The brand line never stands alone where someone might not know what Vossie is (search results, the install prompt, a link preview). The default page title stays "Vossie · The Eduvos student marketplace".
3. **The hero stays as built** ("Buy & sell **textbooks** on campus"). It's the functional line and it works. The brand line goes where the site says who it is: the meta description, the install description, the share card and the footer (section 3.6).
4. **One test for everything beyond buying and selling** (section 4). A feature that fails it isn't built, however good it is.
5. **Editorial lives in the Hub, as a fourth kind of post: the story.** No separate blog, section or menu item. "Hub" stays the one menu item for everything that isn't shopping.
6. **Stories can show the things they talk about.** A line in the body holding only a link to a listing, a shop or a collection becomes a card (section 5.3). No new syntax: writers paste links.
7. **The Hub chooses every story, and none is paid for.** A story about a student needs their consent, and everyone pictured needs theirs; the editor records it (section 5.5).
8. **Stories have no comments, likes or share counts.**
9. **The Stories tab appears only once four stories are ready,** then one or two a month, planned around the academic year (section 5.7).
10. **Four later avenues are listed, not designed:** textbooks by module, a path for sellers, campus market days and a reuse counter (section 6). Each says what it waits on.

---

## 3. Positioning

### 3.1 What Vossie is

For Eduvos and the Hub, not for the site:

> For Eduvos students who need things and students who make things, Vossie is the campus marketplace run by the Incubation Hub. Unlike Marketplace or WhatsApp groups, every shop is checked, you meet at an approved pickup point, and every sale helps a student business grow.

Said to each side:

- **Buyers:** "Find it on your campus, from a shop the Hub has checked, and see it before you pay."
- **Sellers:** "Open your shop on campus. It's free to list, and the Hub is behind you."

### 3.2 The brand line

| Line | Verdict |
|---|---|
| **Your campus, open for business.** | **Chosen.** Speaks to buyers and sellers, stays tied to campus, short enough for the share card and the footer |
| Made on campus. Sold on campus. | Strong on student-made, but weaker for second-hand textbooks and swaps, which are a large share of listings |
| Shop students. Back students. | Good for the Hub's mission, but it sounds a bit like a charity, and buying a used calculator isn't charity |
| Where Eduvos hustles grow. | Speaks only to sellers; buyers don't see themselves in it. It suits the Hub's own material better than Vossie's |

### 3.3 The plain line under it

"Buy, sell and swap with students on your Eduvos campus, from shops the Incubation Hub has checked."

Where there's room for only one sentence (the share card), the shorter "The student marketplace for every Eduvos campus" stays.

### 3.4 What the line rests on

Each claim is already true in the build. Copy may only promise what these deliver:

1. **Every shop is checked by the Hub before it can list.** Listings stay invisible drafts until approval (selling spec, decision 7). Verified is a further badge on top.
2. **Handovers happen at approved campus pickup points,** and the rule is never to pay before you see it.
3. **Messages stay in Vossie.** Nobody has to share a phone number (decision 57).
4. **The Hub backs sellers** with mentors, office hours and events.

### 3.5 Voice

- **Say:** students, shop (a seller's storefront), campus, pickup point, swap, pass it on, hustle (sparingly, as the Hub does), prices as "R250".
- **Don't say:** platform, users, vendors, merchants, ecosystem, empower, "community" as a name for Vossie. No exclamation marks.
- **Claims:** "Verified" only for what the Hub verified. "Safe" only next to what makes it so (pickup points, seeing it before paying).

### 3.6 Where each line goes (phase 1)

| Place | File | Now | Becomes |
|---|---|---|---|
| Default page title | `app/layout.tsx` | "Vossie · The Eduvos student marketplace" | Unchanged (decision 2) |
| Meta description | `app/layout.tsx` | "Buy and sell textbooks, tech and services with students on your Eduvos campus." | "Your campus, open for business. Buy, sell and swap with students on your Eduvos campus, from shops the Incubation Hub has checked." (130 characters) |
| Install description | `app/manifest.ts` | As the meta description | As the new meta description |
| Share card | `app/opengraph-image.tsx` | Wordmark, then "The student marketplace for every Eduvos campus" | Wordmark, then "Your campus, open for business." at the current size, then "The student marketplace for every Eduvos campus" smaller underneath |
| Share card alt text | `app/opengraph-image.tsx` | "Vossie, the student marketplace for every Eduvos campus" | "Vossie. Your campus, open for business. The student marketplace for every Eduvos campus." (what the image says) |
| Footer | `components/footer/SiteFooter.tsx` | No line; the two giant links come first | "Your campus, open for business." above the two giant links, in the display face, white (the texture rule). A `<p>`: the hidden "Site links" heading stays the footer's h2 |
| Footer legal row | `components/footer/SiteFooter.tsx` | "An Eduvos Incubation Hub project" | Unchanged |
| Hero | the hero fixture | "Buy & sell {word} on campus" | Unchanged (decision 3) |
| Announcement bar | `data/fixtures/announcements.ts` | Three messages | Unchanged. They're news, not identity |
| Hub banner | `components/home/HubBanner.tsx` | "Built for student hustles, backed by the Hub" | Unchanged. It already says the seller half of section 3.1 |
| The `/sell` pitch | Stage F | A placeholder | Suggested to stage F's plan: lead with "Open your shop on campus" and give the four claims in section 3.4 as the reasons to sell |

One test pins the old wording: the end-to-end system test checks the share card's alt text (`tests/e2e/system.spec.ts`), and changes with it.

---

## 4. The test for anything beyond buying and selling

Anything Vossie adds that isn't buying or selling must do at least one of these:

1. lead a student to something they can buy, or ask for;
2. help a seller sell better;
3. make a handover safer.

If it does none of them, it belongs to another product, and Eduvos already has channels for campus news. Every avenue in sections 5 and 6 says which part of the test it passes.

---

## 5. Stories in the Hub (phase 2)

Passes the test on all three counts: stories lead to shops and listings, teach sellers by example, and repeat the safety rules where people actually read them.

### 5.1 Formats

- **Meet the shop.** A student founder and their shop, in their own words where possible, ending at their storefront. 400 to 700 words. This is the Hub's mission and a sales driver in one.
- **Guides.** "Res setup under R500", "First-year kit", "Exam week". A guide is a story that shows a collection and a few listings (section 5.3). Collections stay as they are; a guide gives one a voice.
- **Seller craft** (pricing, photos, registering a business, tax basics) stays the **tip** kind, which already exists.

### 5.2 Data

`HubPostKind` gains `"story"`. A story uses `HubPost` as tips do (`startsAt`, `place`, `capacity` and `going` are `null`), with two new fields:

| Field | Values |
|---|---|
| `sellerSlug` | The shop the story is about, or `null` (a guide). Any kind may set it, but only stories use it |
| `consentConfirmedAt` | ISO 8601 UTC: when the editor's consent box was ticked (section 5.5). Required to publish a story; `null` for other kinds |

Who ticked the box lives with the post's edit record in staff tools, not on the public post.

### 5.3 Showing listings, shops and collections inside a story

- **The rule:** a paragraph that holds nothing but one link to `/listings/{id}`, `/sellers/{slug}` or `/collections/{slug}` becomes a card. Up to four such lines in a row make one row of cards; a fifth starts a new row.
- **Cards:**
  - a listing uses `ListingGrid`'s card (photo, title, price, campus, badge, Save heart);
  - a shop uses the Hub page's Verified sellers card (round photo, name, campus);
  - a collection uses a link card with its photo, eyebrow and title.
- **When the link doesn't resolve:**
  - an unknown id keeps its words with no link, as a dropped link already does;
  - a listing that is sold or paused, or a paused shop, stays a plain link: the page it opens says what happened.
- **Everything is resolved on the server** when the post renders, so a sold listing stops showing as a card without anyone editing the story.
- **Only stories** get cards. A link alone on a line in a tip, event or office hours stays a link.

### 5.4 Where stories show

- **The Hub feed:** a Stories tab (`/hub?type=stories#hub-feed`), so the tabs are All, Events, Office hours, Stories and Tips. All shows upcoming events and office hours first (as now), then stories newest first, then tips newest first. A story card has the cover photo, "Story" as its eyebrow, the title, the date and the summary.
- **The story's page** (`/hub/[id]`): the breadcrumb The Hub › Stories, the cover, the title, the date and campus, the body with its cards, then **Visit {shop}** (navy pill) when `sellerSlug` is set, then More from the Hub as now.
- **The storefront:** when a published story names the shop, "Read their story" (a sky-dark link) sits under the shop's about text, linking the newest one.
- **Link previews:** a story's share card is its cover photo with its title, because stories get passed around on WhatsApp.
- **The sitemap** lists stories, as it lists every Hub post.
- **Not the homepage, for now.** The Hub banner's "Our story" link already leads to the Hub, and a new homepage section would cost bytes and a layout of its own. Revisit once there are six or more stories.

### 5.5 Rules

- **The Hub chooses.** Mentors and admins write and publish stories; no shop can buy one, and a story never carries an advert.
- **Consent.** The editor shows "Everyone named or pictured in this story has agreed to it" for stories. It must be ticked to publish. A story names a student by their first name and their shop's name only, unless they ask for more.
- **No buyers.** A story never names or pictures a buyer, as requests never name the asker (community spec decision 2).
- **No comments, likes or share counts** (decision 8). People who want to respond can message the shop.

### 5.6 Writing them

Stage G's post editor (staff tools spec section 4) gains the story kind: the same fields as a tip, plus the shop (a picker of approved shops, or none) and the consent box. The preview shows the cards as they will render.

### 5.7 When to publish

- **Launch:** the Stories tab appears once four stories are ready: two Meet the shop and two guides. An empty or one-post tab looks worse than no tab.
- **Then:** one or two a month. A Meet the shop every month, and a guide timed to each moment below. The Hub takes the dates from Eduvos's academic calendar.

| Moment | What sells | A guide like |
|---|---|---|
| Start of each semester | Textbooks, res setup, tech | "Res setup under R500" |
| Tests and exams | Notes, tutoring, food | "Exam week, sorted" |
| Year-end move-out | Free items and swaps | "Pass it on before you pack up" |
| Graduation | Gifts, photos, hair and beauty | "Graduation day, booked" |

---

## 6. Later avenues (phase 3)

Each waits on something outside the code, so none is designed here. Each gets its own spec when what it waits on arrives.

| Avenue | What it is | Passes the test by | Waits on |
|---|---|---|---|
| **Textbooks by module** | Listings and requests in Textbooks & notes carry module codes; browse filters by module; "Books for your modules" | Leading students to things they need (1) | Eduvos's module list per qualification. Which modules a student takes stays on their device, not their account, and the privacy page names the key |
| **A path for sellers** | Approved shop → Verified → incubated by the Hub → registered business, shown on the storefront and set by staff | Helping sellers grow, and giving stories their subjects (2) | The Hub defining "incubated" and how it checks a registration. A registration number is seen by staff, never shown. Designed alongside the trust badges so a storefront doesn't collect too many |
| **Campus market days** | Hub pop-up markets where Vossie shops trade in person; an event lists the shops attending, and each shop shows "At the market" that day | Leading to things to buy (1), and handovers at a staffed place (3) | The Hub running one |
| **A reuse counter** | "{n} textbooks passed on this year" on Free & swaps and the Hub page, from confirmed free and swap handovers | Leading to Free & swaps (1) | Real data. It shows only above 100 in the year, and never from the sample store: an invented impact figure must not ship |

---

## 7. What Vossie won't do

- **Social features:** feeds, likes, comments, follower counts or buyer profiles. They need heavy moderation, they expose buyers' personal data (POPIA), and Instagram does them better.
- **Campus news or gossip.** Eduvos comms owns that, and it pulls Vossie away from its purpose.
- **Anonymous forums or open Q&A.** Looking For already covers "can anyone help me find…", with the reports queue behind it.
- **Paid placement presented as editorial,** in stories or anywhere else. Featured today stays a fair draw.

## 8. How we'll know it works

No new tracking. Three measures from data Vossie already keeps:

1. **Enquiries to a featured shop** in the 14 days after its story, against the 14 days before (the enquiry counts in `lib/data/shop-stats.ts`, which the seller dashboard uses).
2. **Whether the Hub keeps the cadence:** stories published each month, from the editor.
3. **What featured sellers say,** asked by their mentor.

Review after three months of stories. If enquiries don't move and the cadence slips, the Stories tab goes, and tips carry on.

## 9. Phasing

1. **Phase 1, the copy (now):** section 3.6. A handful of one-line changes and their tests. It can ship to the preview straight away; it goes live after Eduvos's sign-off (section 12).
2. **Phase 2, stories (after stage G's post editor):** sections 5.2 to 5.6, with four sample stories in the fixtures. Its own plan.
3. **Phase 3 (each when what it waits on arrives):** section 6.

## 10. Accessibility, performance and privacy

- **Accessibility:** the homepage spec's section 10 applies. Cards inside a story sit in a labelled list ("In this story"), and each is one link with the item's name. The footer line is plain text, not a heading. Story cards in the feed are at least 44px tall, like the other cards.
- **Performance:** no new client code. The only client code a story page loads is the Save heart in listing cards, which request pages already load. Story covers in the feed load lazily. Every page stays under the stop line in force (decision 52, or the line Lama last accepted).
- **Privacy:** the consent record (section 5.5). No buyer data appears in a story. Textbooks by module keeps a student's modules on their device (section 6).

## 11. Testing

- **Phase 1:** the new wording in the meta description, the manifest, the share card and its alt text, and the footer line; the footer line's contrast passes axe on the texture.
- **Phase 2:**
  - **unit:** the card rule (each kind; an unknown id keeps its words; a sold listing and a paused shop stay links; four cards to a row; a link with other words beside it stays a link; tips never get cards); the Stories tab and the All order; the storefront's "Read their story"; publishing a story is refused without the consent box;
  - **end to end, at the five sizes:** a Meet the shop story and a guide, the Stories tab, a storefront's story link, and axe on each;
  - **checks:** the JS budget and layout shift for a story page.

## 12. Open questions and waiting on

- **Eduvos marketing's sign-off on the brand line,** before it goes live.
- **The Hub agreeing to own the cadence** (section 5.7). Without someone named to write, phase 2 shouldn't start.
- **Eduvos's academic calendar** for the moments in section 5.7.
- **Eduvos's module list** for textbooks by module (section 6).
