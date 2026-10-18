"use server";

import { notFound } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { recordAudit } from "@/lib/data/audit";
import { answerBooking, canEditPost, getPostRow, saveHubPost } from "@/lib/data/hub-posts";
import { notify } from "@/lib/data/notifications";
import { attachPhotos, deletePhotosUsedBy, photoSrcsOf, storePhotos } from "@/lib/data/photos";
import { hubChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field, fileList } from "@/lib/selling/action-helpers";
import { readUploads } from "@/lib/selling/uploads";
import { requireStaff } from "./access";
import { clearStaffForm, leaveNotice, postForm, postPrefix } from "./form-state";
import { slotAnswerText } from "./notification-text";
import { bookSlotPath, editPostPath, HUB_MANAGE_PATH, HUB_NEW_PATH } from "./paths";
import { checkPost, POST_KEEP_MAX, sastToUtc } from "./post-rules";

// The Hub's tools' Server Actions (staff tools spec 2.4; plan decisions 11, 12 and 14): saving a post, its Preview,
// and answering a slot request. Mentors and admins only; a mentor edits only their own posts, an admin any. Each
// writes one audit entry when something changed, and ends with done().

/** The owner of the Hub's cover photos (plan decision 11): not an account, so deleting a staff member's keeps them. */
const HUB_PHOTOS = "hub";
const QUEUE = `${HUB_MANAGE_PATH}#hub-queue`;

/** The fields kept for the editor after a Preview or a failed save: the body up to 8,000 characters (plan decision 12). */
function typedValues(formData: FormData, cover: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of ["kind", "title", "campus", "date", "time", "place", "capacity", "summary"]) {
    values[name] = keepTyped(field(formData, name));
  }
  values.body = [...field(formData, "body")].slice(0, POST_KEEP_MAX).join("");
  values.published = field(formData, "published") === "yes" ? "yes" : "";
  values.cover = cover;
  return values;
}

/** A cover stored on an earlier Preview: only one of the Hub's photos that's still waiting counts. */
async function keptCover(formData: FormData, now: Date): Promise<string> {
  const src = field(formData, "keepCover");
  return src && (await photoSrcsOf(HUB_PHOTOS, null, now)).has(src) ? src : "";
}

/**
 * Whether the post starts at a time that has passed, for a new event or office hours or one whose date or time is
 * being changed (amendment 12.5). A post that has already passed can still be edited, as long as its start is left as
 * it is, so h-012 stays editable. A tip has no start. Compared as moments: stored times may omit the milliseconds.
 */
function startsInThePast(formData: FormData, before: string | null, now: Date): boolean {
  const kind = field(formData, "kind");
  if (kind !== "event" && kind !== "office-hours") return false;
  const startsAt = sastToUtc(field(formData, "date"), field(formData, "time"));
  if (!startsAt) return false;
  if (before && Date.parse(before) === Date.parse(startsAt)) return false;
  return Date.parse(startsAt) <= now.getTime();
}

/** The codes that come before the date field in the editor (lib/staff/errors.ts), so a past date is listed in order. */
const BEFORE_DATE: ReadonlySet<string> = new Set([
  "post-kind-missing",
  "post-title-missing",
  "post-title-length",
  "post-campus-missing",
]);

function withPastDate(codes: readonly string[]): string[] {
  let at = 0;
  codes.forEach((code, index) => {
    if (BEFORE_DATE.has(code)) at = index + 1;
  });
  return [...codes.slice(0, at), "post-date-past", ...codes.slice(at)];
}

/**
 * Save the post, or Preview it (spec 2.4, plan decision 12). A new cover is checked and stripped (selling's
 * readUploads) and stored straight away, so a Preview keeps it for the save. Preview keeps every field and shows the
 * body rendered; Save checks everything and, when it's right, writes the post, makes the cover the post's, and goes
 * back to the list.
 */
export async function savePost(formData: FormData): Promise<void> {
  const raw = field(formData, "post");
  const id = raw === "" ? null : isId(raw) ? raw : undefined;
  const path = id ? editPostPath(id) : HUB_NEW_PATH;
  const account = await requireStaff("hub", path);
  if (id === undefined) notFound();
  const existing = id ? await getPostRow(id) : null;
  // A mentor editing someone else's post gets the 404, as for a page they can't open (plan decisions 1 and 11).
  if (id && (!existing || !canEditPost(account, existing))) notFound();
  const now = new Date();
  const form = postForm(id);

  const files = fileList(formData, "cover");
  const read = files.length > 0 ? await readUploads(files.slice(0, 1), 1) : { uploads: [], errors: [] };
  const upload = read.uploads[0] ?? null;
  const cover = upload ? (await storePhotos(HUB_PHOTOS, [upload], now))[0] : await keptCover(formData, now);
  const values = typedValues(formData, cover);

  if (field(formData, "intent") === "preview") {
    await writeFormState(form, { errors: [...read.errors], values, notice: "preview" }, now);
    done(`${path}#${postPrefix(id)}-preview`);
  }

  const check = checkPost(
    {
      kind: field(formData, "kind"),
      title: field(formData, "title"),
      campus: field(formData, "campus"),
      date: field(formData, "date"),
      time: field(formData, "time"),
      place: field(formData, "place"),
      capacity: field(formData, "capacity"),
      summary: field(formData, "summary"),
      body: field(formData, "body"),
      published: values.published === "yes",
    },
    (await getCampuses()).map((campus) => campus.slug),
  );
  const late = startsInThePast(formData, existing?.startsAt ?? null, now);
  const errors = [...(late ? withPastDate(check.errors) : check.errors), ...read.errors];
  if (errors.length > 0 || !check.value) {
    await writeFormState(form, { errors, values, notice: null }, now);
    done(path);
  }

  const saved = await saveHubPost({
    id,
    fields: check.value,
    cover: cover ? { src: cover, alt: "" } : null,
    authorId: account.id,
    now,
  });
  if (!saved) notFound();
  if (cover) {
    const use = `post:${saved.row.id}`;
    await attachPhotos(HUB_PHOTOS, [cover], use);
    await deletePhotosUsedBy(HUB_PHOTOS, use, new Set([cover]));
  }
  await recordAudit({
    staff: { id: account.id, firstName: account.firstName },
    action: saved.created ? "post-created" : "post-updated",
    target: { kind: "post", id: saved.row.id, name: saved.row.title },
    detail: saved.row.published ? "Published" : "Draft",
    now,
  });
  hubChanged();
  await clearStaffForm(form);
  await leaveNotice(saved.row.published ? "post-published" : "post-draft", now);
  done(HUB_MANAGE_PATH);
}

/** A change that didn't happen (plan decision 23): no audit entry, nothing sent, and the page says so. */
async function nothingChanged(now: Date): Promise<never> {
  await leaveNotice("nothing", now);
  done(QUEUE);
}

/** Accept or Decline a slot request (spec 2.4, plan decision 14): the student is told either way. */
export async function answerSlot(formData: FormData): Promise<void> {
  const staff = await requireStaff("hub", HUB_MANAGE_PATH);
  const now = new Date();
  const id = field(formData, "booking");
  const answer = field(formData, "answer");
  if (!isId(id) || (answer !== "accepted" && answer !== "declined")) return nothingChanged(now);
  const answered = await answerBooking(id, answer, staff.id, now);
  if (!answered) return nothingChanged(now);
  await recordAudit({
    staff: { id: staff.id, firstName: staff.firstName },
    action: answer === "accepted" ? "booking-accepted" : "booking-declined",
    target: { kind: "booking", id, name: `${answered.studentName}: ${answered.postTitle}` },
    subjectId: answered.accountId,
    now,
  });
  await notify({
    accountId: answered.accountId,
    kind: "booking",
    subjectId: id,
    text: slotAnswerText(answer, answered.postTitle),
    href: bookSlotPath(answered.postId),
    now,
  });
  await leaveNotice(answer === "accepted" ? "booking-accepted" : "booking-declined", now);
  done(QUEUE);
}
