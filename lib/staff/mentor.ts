import { badgeLabel } from "@/lib/format";
import { replyRate } from "@/lib/selling/badges";
import type { EnquiryCounts, MentorFlag, MentoredShop, SellerStatus } from "@/lib/types";

// The mentor dashboard's flags and its CSV (staff tools spec 2.6; plan decisions 15 and 17). Mentors see numbers,
// never messages (FUNCTION-MAP K1). Plain functions; the words are samples for Lama to change (plan decision 22).

/** The dashboard's window: the spec's first flag counts 14 days. */
export const MENTOR_WINDOW_DAYS = 14;
/** "Slow replies" is under half answered within 48 hours. */
export const SLOW_REPLY_RATE = 0.5;

/** A shop's flags, in this order (spec 2.6). Slow replies only count once an enquiry is due (selling plan decision 18). */
export function mentorFlags(counts: EnquiryCounts, status: SellerStatus): MentorFlag[] {
  const flags: MentorFlag[] = [];
  if (counts.enquiries === 0) flags.push("no-enquiries");
  const rate = replyRate(counts);
  if (rate !== null && rate < SLOW_REPLY_RATE) flags.push("slow-replies");
  if (status === "paused") flags.push("paused");
  return flags;
}

/** Each flag's name (the spec's words) and what it means, for the shop's mentor page. */
export const FLAG_WORDS: Readonly<Record<MentorFlag, { label: string; explanation: string }>> = {
  "no-enquiries": {
    label: "No enquiries in 14 days",
    explanation: "No buyer has asked about a listing in the last 14 days. New listings or better photos may help.",
  },
  "slow-replies": {
    label: "Slow replies (under 50% in 48 hours)",
    explanation: "Fewer than half of the enquiries that are due were answered within 48 hours.",
  },
  paused: {
    label: "Shop paused",
    explanation: "Buyers can't see the shop's listings until it's resumed.",
  },
};

/** "3 of 4", or "None due yet" while no enquiry has come due (selling plan decision 18). */
export function repliesInTime(counts: EnquiryCounts): string {
  return counts.due === 0 ? "None due yet" : `${counts.repliedInTime} of ${counts.due}`;
}

const STATUS_WORDS: Readonly<Record<SellerStatus, string>> = { pending: "Waiting", approved: "Open", paused: "Paused" };

/** A shop's status as the dashboard words it. */
export function statusWords(status: SellerStatus): string {
  return STATUS_WORDS[status];
}

/**
 * One CSV cell (RFC 4180). Text always goes in double quotes, with any quotes inside doubled, so a separator that isn't
 * a comma can't split it: where Excel's list separator is a semicolon, an unquoted `Bakes;=1+1;` would become three
 * cells, the second a formula. Text that starts with =, +, -, @, a tab or a carriage return gets an apostrophe first,
 * so a spreadsheet never runs a shop's name as a formula (plan decision 17, amendment 12.1). Numbers go in bare.
 */
export function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A UTF-8 byte-order mark: without it Excel reads the file as ANSI and garbles "Zoë's Café" (amendment 12.2). */
const BYTE_ORDER_MARK = "\uFEFF";

const CSV_HEADER = [
  "Shop",
  "Campus",
  "Mentor",
  "Badge",
  "Status",
  "Enquiries (14 days)",
  "Due for a reply",
  "Replied within 48 hours",
  "Sales confirmed (14 days)",
  "Flags",
];

/**
 * The dashboard's table as a CSV file (spec 2.6), one line per shop, each ending in CRLF. No messages, no emails. It
 * starts with a byte-order mark, so the route sends the body as it is (amendment 12.2).
 */
export function mentorCsv(rows: readonly MentoredShop[], campusNames: ReadonlyMap<string, string>): string {
  const lines = [
    CSV_HEADER,
    ...rows.map((row) => [
      row.name,
      campusNames.get(row.campusSlug) ?? row.campusSlug,
      row.mentorName,
      row.badge ? badgeLabel(row.badge) : "",
      statusWords(row.status),
      row.counts.enquiries,
      row.counts.due,
      row.counts.repliedInTime,
      row.counts.salesConfirmed,
      row.flags.map((flag) => FLAG_WORDS[flag].label).join("; "),
    ]),
  ];
  return BYTE_ORDER_MARK + lines.map((cells) => `${cells.map(csvCell).join(",")}\r\n`).join("");
}
