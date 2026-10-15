import { badgeLabel } from "@/lib/format";
import { replyRate } from "@/lib/selling/badges";
import type { EnquiryCounts, MentorFlag, MentoredShop, SellerStatus } from "@/lib/types";

// The mentor dashboard's flags and its CSV (staff tools spec 2.6; plan decisions 15 and 17; amendment 29). Mentors
// see numbers, never messages (FUNCTION-MAP K1). Plain functions; the words are samples for Lama to change (plan
// decision 22).

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
    // True of a seller's own pause and of a Hub pause (amendments 15 and 30).
    explanation: "The shop's listings are off every list until it's resumed.",
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
 * The UTF-8 byte order mark the file starts with (amendment 29), so a spreadsheet opening it reads accented names and
 * emoji as UTF-8 rather than guessing an older encoding.
 */
export const CSV_BOM = "\uFEFF";

// What a spreadsheet may run as a formula when a cell starts with it (plan decision 17, amendment 29): =, +, - and @,
// and a tab or a carriage return, which some spreadsheets skip before reading the rest as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell (RFC 4180). Text that starts with =, +, -, @, a tab or a carriage return gets an apostrophe first, so a
 * spreadsheet never runs a shop's name as a formula. A cell with a comma, a quote or a line break is quoted, its
 * quotes doubled. Numbers are written as they are.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

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
 * The dashboard's table as a CSV file (spec 2.6): the byte order mark, a header row and one line per shop, each ending
 * in CRLF. No messages, no emails.
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
  return CSV_BOM + lines.map((cells) => `${cells.map(csvCell).join(",")}\r\n`).join("");
}
