"use server";

import { notFound } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { recordAudit } from "@/lib/data/audit";
import { answerBooking, canEditPost, getPostRow, saveHubPost } from "@/lib/data/hub-posts";
import { notify } from "@/lib/data/notifications";
import { isRefused } from "@/lib/data/refused";
import { attachPhotos, deletePhotosUsedBy, photoSrcsOf, storePhotos } from "@/lib/data/photos";
import { hubChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field, fileList } from "@/lib/selling/action-helpers";
import { readUploads } from "@/lib/selling/uploads";
import { orNotFound, requireStaffAction } from "./access";
import { sampleFollowUps } from "./follow-ups";
import { clearStaffForm, leaveNotice, postForm, postPrefix } from "./form-state";
import { slotAnswerText } from "./notification-text";
import { leaveOnceToken, type OnceSent, sentOnceToken, takeOnceToken, tokenTakenInSql } from "./once";
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

/** A new post's form sent again (amendment 15.7): back to where the first send went, with the notice it left. */
async function sentAgain(sent: OnceSent, now: Date): Promise<never> {
  await leaveNotice(sent.notice, now);
  done(sent.path);
}

/**
 * Save the post, or Preview it (spec 2.4, plan decision 12). A new cover is checked and stripped (selling's
 * readUploads) and stored straight away, so a Preview keeps it for the save. Preview keeps every field and shows the
 * body rendered; Save checks everything and, when it's right, writes the post, makes the cover the post's, and goes
 * back to the list.
 *
 * A new post is made once, however many times its form is sent (amendment 15.7): the form carries a one-time token, and
 * only the first save to take it makes a post. A later one goes where the first went; one with no token, or a made-up
 * or run-out one, is refused with the form's error and what was typed. A Preview, or a save that fails its checks,
 * leaves the token for the next try. An existing post saved with nothing changed writes nothing (decision 23).
 */
export async function savePost(formData: FormData): Promise<void> {
  const raw = field(formData, "post");
  const id = raw === "" ? null : isId(raw) ? raw : undefined;
  const path = id ? editPostPath(id) : HUB_NEW_PATH;
  const account = await requireStaffAction("hub", path);
  if (id === undefined) notFound();
  const existing = id ? await getPostRow(id) : null;
  // A mentor editing someone else's post gets the 404, as for a page they can't open (plan decisions 1 and 11).
  if (id && (!existing || !canEditPost(account, existing))) notFound();
  const now = new Date();
  const form = postForm(id);
  const previewing = field(formData, "intent") === "preview";

  // A token that has made its post already: go where that save went, before a cover is checked or stored.
  const once = id ? "" : field(formData, "once");
  const earlier = once && !previewing ? await sentOnceToken(once, now) : null;
  if (earlier) await sentAgain(earlier, now);

  const files = fileList(formData, "cover");
  const read = files.length > 0 ? await readUploads(files.slice(0, 1), 1) : { uploads: [], errors: [] };
  const upload = read.uploads[0] ?? null;
  const cover = upload ? (await storePhotos(HUB_PHOTOS, [upload], now))[0] : await keptCover(formData, now);
  const values = typedValues(formData, cover);

  if (previewing) {
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

  // Only now, with a post about to be made, is the token taken. Taking it is one step, so of two posts sent together
  // only one makes the post; the other goes to the list, or where the first says it went. On Supabase save_hub_post
  // takes it itself, in the same transaction as the insert (C4/C5 plan decision 6).
  if (id === null && !tokenTakenInSql()) {
    const token = await takeOnceToken(once, now);
    if (token.kind === "none") {
      await writeFormState(form, { errors: ["once-expired"], values, notice: null }, now);
      done(path);
    }
    if (token.kind === "again") {
      if (token.sent) await sentAgain(token.sent, now);
      done(HUB_MANAGE_PATH);
    }
  }
  let saved: Awaited<ReturnType<typeof saveHubPost>>;
  try {
    saved = await orNotFound(
      saveHubPost({
        id,
        fields: check.value,
        cover: cover ? { src: cover, alt: "" } : null,
        authorId: account.id,
        now,
        onceToken: id === null ? once : undefined,
      }),
    );
  } catch (error) {
    // save_hub_post's answers on Supabase (C4/C5 plan decisions 2 and 6): the token's "none" and "again", as
    // takeOnceToken's; a start that passed between the check and the save; and a cover that ran out in that moment,
    // which shows the "out of date" words with the cover cleared and everything typed kept (open question 3).
    if (isRefused(error, "once-expired")) {
      await writeFormState(form, { errors: ["once-expired"], values, notice: null }, now);
      done(path);
    }
    if (isRefused(error, "cover-invalid")) {
      await writeFormState(form, { errors: ["once-expired"], values: { ...values, cover: "" }, notice: null }, now);
      done(path);
    }
    if (isRefused(error, "once-taken")) {
      const sent = await sentOnceToken(once, now);
      if (sent) await sentAgain(sent, now);
      done(HUB_MANAGE_PATH);
    }
    if (isRefused(error, "date-past")) {
      await writeFormState(form, { errors: [...withPastDate([]), ...read.errors], values, notice: null }, now);
      done(path);
    }
    throw error;
  }
  if (!saved) notFound();
  // Saved with every field and the cover as they were: nothing to write, log or tell (plan decision 23).
  if (!saved.changed) {
    await clearStaffForm(form);
    await nothingChanged(now, HUB_MANAGE_PATH);
  }
  // On Supabase save_hub_post made the cover the post's, wrote the entry and gave back the files to remove (decision 18).
  await sampleFollowUps(async () => {
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
  });
  hubChanged();
  await clearStaffForm(form);
  const notice = saved.row.published ? "post-published" : "post-draft";
  if (id === null) await leaveOnceToken(once, { path: HUB_MANAGE_PATH, notice }, now);
  await leaveNotice(notice, now);
  done(HUB_MANAGE_PATH);
}

/** A change that didn't happen (plan decision 23): no audit entry, nothing sent, and the page says so. */
async function nothingChanged(now: Date, path = QUEUE): Promise<never> {
  await leaveNotice("nothing", now);
  done(path);
}

/** Accept or Decline a slot request (spec 2.4, plan decision 14): the student is told either way. */
export async function answerSlot(formData: FormData): Promise<void> {
  const staff = await requireStaffAction("hub", HUB_MANAGE_PATH);
  const now = new Date();
  const id = field(formData, "booking");
  const answer = field(formData, "answer");
  if (!isId(id) || (answer !== "accepted" && answer !== "declined")) return nothingChanged(now);
  const answered = await orNotFound(answerBooking(id, answer, staff.id, now));
  if (!answered) return nothingChanged(now);
  // On Supabase answer_booking wrote the entry and told the student (decision 3).
  await sampleFollowUps(async () => {
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
  });
  await leaveNotice(answer === "accepted" ? "booking-accepted" : "booking-declined", now);
  done(QUEUE);
}
