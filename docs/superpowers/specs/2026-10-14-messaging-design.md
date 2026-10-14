# Vossie messaging, reports and notifications: design spec

- **Date:** 2026-10-14
- **Status:** Built (2026-10-14), in sample mode. Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log (decision 70 for the changes made on plan review and during the build).
- **Scope:** stage E. In-app messages between buyers and sellers, swap offers, the sale status that feeds trust badges, reports, and notifications. It builds on stage D's sample store and sessions (`2026-10-14-accounts-design.md`).

## Related documents

| File | What it is |
|---|---|
| `docs/reference/FUNCTION-MAP.md` | F (messaging and enquiries), H (trust and safety), I (notifications), and the rules in section 6 (message 1,000 characters, swap offer 200, report detail 500, the 48-hour response window, sale confirmation and the 7-day auto-confirm) |
| `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md` | The listing page's actions (spec 5.4) and the sign-in links (5.9) |
| `docs/superpowers/specs/2026-10-14-accounts-design.md` | Sessions, `requireAccount`, the sample store |

---

## 1. Goal

A signed-in student can message a seller about a listing (or offer a swap), keep the conversation going, and confirm the sale when it happens. Anyone can report a listing, a seller or a request, and signed-in students see what needs their attention.

## 2. Decisions

1. **The composer is a page, not a sheet:** `/listings/[id]/message`. A sheet needs client code on every listing page; a page works before the app's JavaScript arrives and adds no bytes to the listing page. On the listing page, signed-in visitors' **Message seller** goes there; signed-out visitors still go to sign-in with `next` set to the composer.
2. **One conversation per buyer and listing.** Messaging the same listing again opens the existing thread.
3. **Scam tips sit beside the composer, and the server checks the message.** Three short tips are always shown. When a message mentions paying in advance, bank details, a deposit, a courier, or a code, sending it shows "Check this before you send" with the tip that applies, and a **Send anyway** button. The check runs on the server, so no client code is needed.
4. **Swap offers are part of the first message:** when the listing takes swaps, the composer has an optional "Offer a swap" field (200 characters). It shows in the thread as a highlighted offer.
5. **Sale status, per conversation** (the old demo's rules):

   | Status | When |
   |---|---|
   | Asked | The buyer has written and the seller hasn't replied |
   | Replied | The seller has answered |
   | Done | The seller has marked it completed |
   | Confirmed | The buyer has confirmed the sale, or 7 days have passed since Done |

   - "It didn't happen" from the buyer reopens it as Replied and doesn't count.
   - The 7 days are checked when the conversation is read: there's no job runner yet.
   - Confirmed sales and first-reply times are stored for the trust badges (stage G recalculates them).
6. **No live updates.** A thread refreshes when you open it or send. A **Refresh** link sits by the header of the thread. Live updates need a realtime connection (Supabase) and client code; they come later.
7. **The WhatsApp handoff is cut.** In-app messages cover it, and handing over a phone number exposes personal data (POPIA). The decisions log records it, and the go-live checklist row closes.
8. **Reports are pages too:**
   - `/report?listing=l-001`, `/report?seller=tech-corner` or `/report?request=r-001`;
   - seven reasons (scam or fraud, prohibited item, misleading listing, offensive content, harassment, spam, something else) and optional detail (500 characters);
   - then a thank-you that says what happens next.
   - Reporting needs sign-in, so reports can be followed up and abuse limited. The existing "Report this listing/seller/request" links point here for signed-in visitors.
9. **Notifications are a page, `/notifications`**, plus a count on the header. Kinds:
   - a new message;
   - a sale to confirm;
   - your report was handled (stage G);
   - your shop was approved (stage F/G).

   Opening the page marks them read. The header's count comes from a small Server Component passed into the header as a slot, inside `<Suspense>`, so the header stays prerendered and no client code is added.
10. **The inbox has two tabs,** Buying and Selling (`?tab=selling`), as links. A seller's enquiries live under Selling, which replaces the old demo's separate enquiries page.
11. **Names:** buyers appear to sellers by first name; sellers appear by their shop name. Emails are never shown to the other party.
12. **Messages are plain text:** line breaks are kept, nothing is rendered as HTML, and links aren't made clickable. That's safer for scams.

---

## 3. Screens

### 3.1 The composer (`/listings/[id]/message`)
- Requires an account (`requireAccount`); a seller can't message their own listing (it says so and links to the listing).
- A listing summary (photo, title, price, seller, campus), an h1 "Message {shop name}", a textarea (1,000 characters, a count under it), the swap field when it applies, **Send**, and the three tips.
- Errors: "Write a message first.", "Keep it under 1,000 characters.".
- After sending: the thread, with a toast-like note "Sent. Sellers usually reply within a day." shown once (a flash cookie, read on the server).
- A paused or sold listing can't be messaged: it says so and links back.

### 3.2 The inbox (`/messages`)
- The h1 "Messages", the Buying and Selling tabs (Selling only when the account has a shop), and a list of conversations, newest activity first.
- Each row is a link: the other party's name, the listing's title and photo, the last message's first line, the time (SAST: "14:05" today, "Mon", or "12 Oct"), the status pill, and an unread dot.
- Empty: "No messages yet. Find something you like and message the seller." with Browse.

### 3.3 A thread (`/messages/[id]`)
- Only the buyer and the seller can open it; anyone else gets the 404.
- The listing summary at the top with the status pill, then the messages oldest first.
  - Each message is a bubble, yours on the right in navy, theirs on the left on panel, with the time.
  - The swap offer is a pale callout.
- A reply form at the bottom (1,000 characters).
- The seller sees **Mark as completed** once there's been a reply; the buyer then sees **Confirm the sale** and **It didn't happen**.
- Opening the thread marks it read.

### 3.4 Report (`/report`)
- Requires an account. The h1 "Report this listing" (or seller, or request), the reasons as radio buttons, the detail, and **Send report**.
- Then the thank-you: "Thanks. The Hub reviews reports within two working days. We'll let you know what happens." with a link back.
- Reports are stored with the reporter, the target, the reason, the detail and the time, for stage G's queue.

### 3.5 Notifications (`/notifications`)
- The h1 "Notifications" and a list, newest first: an icon, a sentence ("Tech corner replied about Casio fx-991ZA Plus calculator"), the time, and a link to the thing.
- Empty: "Nothing new."

### 3.6 Changes to existing pages
- **Listing page:** for signed-in visitors, Message seller links to the composer, and Report links to `/report?listing=`. The actions bar stays a Server Component. The link target depends on the session, so it's read inside `<Suspense>` in a small part of the bar, and the fallback is the signed-out link.
- **Storefront, request page:** Message and Report likewise.
- **Account page:** a Messages row with the unread count.
- **Context strip:** new messages and sales to confirm come from the store.

---

## 4. Data

The sample store gains:
- conversations (id, listing, buyer, seller, status, timestamps);
- messages (id, conversation, sender, body, swap offer, sent at, read at);
- reports;
- notifications.

Functions:
- `startConversation`, `sendMessage`, `markCompleted`, `confirmSale`, `rejectSale`;
- `getInbox(accountId, tab)`, `getThread(id, accountId)`;
- `createReport`;
- `getNotifications`, `markNotificationsRead`, `unreadCounts(accountId)`.

All per-request: none is cached.

## 5. Accessibility

- The thread is a list of messages, each with "You" or the sender's name and the time as text, so it isn't read by colour or side alone.
- The status pill has text.
- The reply form keeps its label.
- Error messages are linked to their fields.

## 6. Performance

No client code beyond the shell: forms post to Server Actions. The header's count is a server slot. Every page stays under the stop line.

## 7. Testing

- **Unit:**
  - the store functions and status rules (including the 7-day auto-confirm and "It didn't happen");
  - the scam check's words;
  - who can open a thread;
  - the time labels;
  - each component's states.
- **End to end** (two browser contexts, a buyer and a seller):
  - message, reply, mark completed, confirm, and the statuses;
  - the swap offer;
  - the scam warning and Send anyway;
  - a report and its thank-you;
  - notifications and the header count;
  - the bundle-blocked form path.
- **Checks:** axe on each page, the JS budget, layout shift and screenshots.

## 8. Not in this stage

Live updates, push or email notifications, attachments, blocking a user, and the staff side of reports (stage G).

## 9. Changes on plan review and during the build (2026-10-14)

The plan (`docs/superpowers/plans/2026-10-14-messaging.md`) refines these points, and so did its build and reviews (items 11 to 23, with the commit for each in the plan's "Changes made during the build"); where they differ, these win.

1. **Shops answer, not people.** A conversation belongs to a shop (its slug); whoever owns the shop answers. The storefront's Message goes to `/sellers/[slug]/message`, a question with no listing, one per buyer and shop. Stage G decides whether shop questions count as enquiries for trust badges.
2. **Messaging the same listing again:** the Message link goes straight to the existing thread, and the composer shows a note instead of redirecting (a redirect would trap Back).
3. **The scam check runs on replies too.**
4. **No live character count:** a static hint ("Up to 1,000 characters"), and the server says what's too long. "Sent." is a note kept in the form state and cleared once read, not a flash cookie.
5. **The header count** is a red badge on the account icon (a third icon doesn't fit at 360px). It's as fresh as the last full page load or post, and the inbox and threads have a Refresh link (a full page load).
6. **Every write refreshes and then redirects,** which clears the pages Next keeps for Back; the end-to-end tests check the kept-page paths.
7. **Reports:** one per target while it's open, and 10 a day per account. Privacy settings list "Reports you've made".
8. **Deleting an account** removes its messages, notifications and reports. The other person keeps their side of each conversation, with the deleted side named "Deleted account", the note "This person has left Vossie, so you can't reply." and no reply form. A sale waiting for the deleted buyer's confirmation goes back to Replied. A conversation with neither side left, or with nothing left in it, is deleted. The data export gains conversations, reports and notifications, with no ids.
9. **How long messages are kept is Eduvos's call** (a go-live item). In sample mode they last until the server restarts.
10. **Testing:** until stage F, the seller in end-to-end tests is the sample Tech corner account, used only on each test's own conversation.
11. **A sale nobody can dispute doesn't count, from either side.** Item 8 names the buyer; the seller is the same. `markCompleted` refuses when the buyer has left. When either side's account is deleted while a sale is Done, it goes back to Replied and the completion is forgotten, so it never confirms itself. `confirmSale` and `rejectSale` refuse when the seller has gone, and the buyer sees no sale buttons then.
12. **Notifications:**
    - One unread *message* notification per conversation per person; a sale to confirm is its own notification, and it's marked read when the sale is confirmed (by the buyer or by itself) or rejected.
    - A buyer's second message before any reply still tells the seller "{Name} asked about {title}", not "replied".
    - Opening a thread marks that conversation's notifications read, and opening `/notifications` marks them all read, so a page that shows what's new is drawn before either is opened. The page shows the newest 50.
13. **The scam check catches more ways to say it.** Paying in advance also matches "before" (with first, upfront, in advance), "transfer", "cash send" and "eWallet" on their own; bank details also match "bank account" and "bank acc". "I'll pay cash when I see it." still passes.
14. **Message text** loses `\r\n`, control characters other than line breaks and tabs, and invisible and direction-changing characters (U+202A to U+202E, U+2066 to U+2069, U+200B, U+200E, U+200F, U+2060 and U+FEFF), and is trimmed. U+200D stays, since emoji need it, and a message of only those characters counts as empty. The limits count code points, so an emoji family counts as several characters.
15. **Reports:** the limit's message says what it counts ("You've sent 10 reports in the last 24 hours. Try again later."). Each report form starts empty for its target, because `/report?listing=A` and `/report?seller=B` are one page to the router. A report keeps its target's title for stage G's queue.
16. **Deletion and export:** deleting an account clears the read time on the other side's remaining messages, since it was when the deleted person read them. The data export settles any sale due to confirm itself first, so it never says "done" for a sale that has already confirmed.
17. **The composer offers an existing conversation first,** even when the listing has since been paused or sold ("You've already messaged {shop} about this." with Open the conversation), before it says the listing isn't available.
18. **Every link this stage adds skips prefetch** (`prefetch={false}`), calls to action included, so no page pays for another route's chunk (decision 53).
19. **Field ids are unique per item** (`composer-message-l-001`, `thread-reply-conv-s1`, `report-reason-listing-l-001`), because Next keeps the last pages hidden in the DOM and a label or an error summary's link would otherwise find the first element with that id.
20. **What "works without JavaScript" means.** It means without the app's bundle (blocked or failed), which the end-to-end tests check. Next reveals streamed parts with a small inline script, so with JavaScript turned off in the browser the request-time parts, the forms included, stay on their skeletons. An unknown or other person's conversation, composer or report target shows the 404 page with status 200, because it's raised inside `<Suspense>` after streaming has started (as for unknown listings, decision 39).
21. **The header, the menu and the strip.** The signed-in menu has no Messages row: one was tried, cost 16 B on every page and made the menu scroll on a 360px phone. The account icon carries the badge (item 5), the account page lists Messages and Notifications with their counts (replacing 3.6's single Messages row), and the homepage strip counts new messages and sales to confirm and links to the inbox.
22. **Search engines:** `/messages`, `/notifications`, `/report`, `/listings/*/message` and `/sellers/*/message` are in `robots.txt`'s disallow list, and every new page is `noindex`.
23. **Performance:** the stage added no client code. Every page ended 1 B lighter than it started, from the strip's Open inbox link (now `/messages`, with no prefetch), and the signed-in messaging pages are 150,613 B each, against a stop line of 152,305 B.
