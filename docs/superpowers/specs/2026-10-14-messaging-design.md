# Vossie messaging, reports and notifications: design spec

- **Date:** 2026-10-14
- **Status:** Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log.
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
