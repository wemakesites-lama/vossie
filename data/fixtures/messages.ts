import type { ConversationRow, MessageRow, NotificationRow } from "@/lib/data/rows";

// Two sample conversations (messaging plan decision 16): Thandi (acc-student) with Tech corner, whose owner is Sipho
// (acc-seller). One is about the headset, with a swap offer and Sipho's reply still unread; in the other Sipho marked
// the calculator sale done and Thandi hasn't confirmed it. Fixtures import nothing at run time. The words are samples
// for Lama to change; the notifications' sentences must match lib/messaging/notification-text.ts (its test checks).

export const sampleConversations: readonly ConversationRow[] = [
  {
    id: "conv-s1",
    listingId: "l-007",
    listingTitle: "Gaming headset, barely used",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "replied",
    createdAt: "2026-10-13T08:12:00.000Z",
    lastMessageAt: "2026-10-13T09:05:00.000Z",
    firstReplyAt: "2026-10-13T09:05:00.000Z",
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  },
  {
    id: "conv-s2",
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "done",
    createdAt: "2026-10-12T10:20:00.000Z",
    lastMessageAt: "2026-10-12T16:30:00.000Z",
    firstReplyAt: "2026-10-12T10:48:00.000Z",
    completedAt: "2026-10-13T15:00:00.000Z",
    confirmedAt: null,
    confirmedBy: null,
  },
];

export const sampleMessages: readonly MessageRow[] = [
  {
    id: "msg-s1",
    conversationId: "conv-s1",
    from: "buyer",
    body: "Hi! Is the headset still available? I'd like to swap for it if you're open to that.",
    swapOffer: "A JBL Go 3 Bluetooth speaker, about a year old",
    sentAt: "2026-10-13T08:12:00.000Z",
    readAt: "2026-10-13T09:01:00.000Z",
  },
  {
    id: "msg-s2",
    conversationId: "conv-s1",
    from: "seller",
    body: "Hi Thandi, it is. Can I see the speaker first?\nI'm at the library entrance after 12:00 most days.",
    swapOffer: null,
    sentAt: "2026-10-13T09:05:00.000Z",
    readAt: null,
  },
  {
    id: "msg-s3",
    conversationId: "conv-s2",
    from: "buyer",
    body: "Hi! Is the calculator still available? I need it for my stats test on Friday.",
    swapOffer: null,
    sentAt: "2026-10-12T10:20:00.000Z",
    readAt: "2026-10-12T10:45:00.000Z",
  },
  {
    id: "msg-s4",
    conversationId: "conv-s2",
    from: "seller",
    body: "Yes, it is. I can meet you at the library entrance at 13:00 tomorrow.",
    swapOffer: null,
    sentAt: "2026-10-12T10:48:00.000Z",
    readAt: "2026-10-12T11:00:00.000Z",
  },
  {
    id: "msg-s5",
    conversationId: "conv-s2",
    from: "buyer",
    body: "Perfect, see you there.",
    swapOffer: null,
    sentAt: "2026-10-12T16:30:00.000Z",
    readAt: "2026-10-12T17:10:00.000Z",
  },
];

export const sampleNotifications: readonly NotificationRow[] = [
  {
    id: "note-s1",
    accountId: "acc-student",
    kind: "message",
    subjectId: "conv-s1",
    text: "Tech corner replied about Gaming headset, barely used",
    href: "/messages/conv-s1",
    createdAt: "2026-10-13T09:05:00.000Z",
    readAt: null,
  },
  {
    id: "note-s2",
    accountId: "acc-student",
    kind: "sale-to-confirm",
    subjectId: "conv-s2",
    text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
    href: "/messages/conv-s2",
    createdAt: "2026-10-13T15:00:00.000Z",
    readAt: null,
  },
  {
    id: "note-s3",
    accountId: "acc-seller",
    kind: "message",
    subjectId: "conv-s1",
    text: "Thandi asked about Gaming headset, barely used",
    href: "/messages/conv-s1",
    createdAt: "2026-10-13T08:12:00.000Z",
    readAt: "2026-10-13T09:01:00.000Z",
  },
  {
    id: "note-s4",
    accountId: "acc-seller",
    kind: "message",
    subjectId: "conv-s2",
    text: "Thandi replied about Casio fx-991ZA Plus calculator",
    href: "/messages/conv-s2",
    createdAt: "2026-10-12T16:30:00.000Z",
    readAt: "2026-10-12T17:10:00.000Z",
  },
];
