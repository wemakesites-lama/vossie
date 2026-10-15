"use client";

import { useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { cx } from "@/lib/cx";
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_MB,
  PHOTO_TYPES,
  PHOTOS_PER_LISTING,
  SHRINK_MAX_SIDE,
  SHRINK_QUALITY,
} from "@/lib/photos/rules";
import { applyPhotoMove, newPhotoToken, type PhotoOp } from "@/lib/selling/photo-order";
import type { PhotoType } from "@/lib/types";

/** A photo the server already has: its address, its description ("" means the title) and its small picture's address. */
export type SavedPhoto = { src: string; alt: string; thumb: string };

type Item = { key: string; src: string | null; file: File | null; alt: string; thumb: string };

type PhotoFieldProps = {
  /** The form's id prefix (plan decision 23): "new" or "edit-<id>". */
  prefix: string;
  photos: readonly SavedPhoto[];
  /** The server's message about the photos, if any. */
  error: string | undefined;
};

const BUTTONS: ReadonlyArray<{ op: PhotoOp; label: string }> = [
  { op: "cover", label: "Make cover" },
  { op: "earlier", label: "Move earlier" },
  { op: "later", label: "Move later" },
  { op: "remove", label: "Remove" },
];

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, SHRINK_QUALITY));

/**
 * The browser's part (selling spec 2.3, plan decision 10): the longest side at most 1,600px, re-encoded as WebP at
 * 0.8, or JPEG where the browser can't encode WebP (Safari), which leaves every bit of hidden data behind. A photo the
 * browser can't decode, or can't draw (no canvas memory left), goes as it is, for the server to check and strip.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const width = (canvas.width = Math.max(1, Math.round(bitmap.width * scale)));
    const height = (canvas.height = Math.max(1, Math.round(bitmap.height * scale)));
    // No 2D context throws here, and the photo goes as it is.
    const context = canvas.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    let blob = await encode(canvas, "image/webp");
    if (blob?.type !== "image/webp") {
      // JPEG has no transparency: what was see-through goes white (behind the photo), not black.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      blob = await encode(canvas, "image/jpeg");
    }
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]*$/, "") || "photo"}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}

function pickedMessage(added: number, refused: number, leftOut: number): string {
  const parts: string[] = [];
  if (added > 0) parts.push(added === 1 ? "1 photo added." : `${added} photos added.`);
  if (refused > 0) parts.push(refused === 1 ? "1 wasn't a JPG, PNG or WebP." : `${refused} weren't JPG, PNG or WebP.`);
  if (leftOut > 0) {
    parts.push(`Only ${PHOTOS_PER_LISTING} photos fit, so ${leftOut === 1 ? "1 was" : `${leftOut} were`} left out.`);
  }
  return parts.join(" ");
}

const WAIT = "Wait for your photos to be ready.";

/**
 * The listing form's photos (selling spec 2.3, 2.5 and section 4; plan decisions 9 and 10). Every photo has a hidden
 * `photo` field (a saved photo's address, or "new:<n>" for the n-th file in the file input), a description, and
 * Make cover, Move earlier, Move later and Remove as submit buttons. Rendered on the server, that's a form that works
 * without this component's code: each button posts it. Once the code runs, the buttons work in place, picked photos
 * are shrunk and put back into the file input, and a status line says what happened.
 */
export function PhotoField({ prefix, photos, error }: PhotoFieldProps) {
  const [items, setItems] = useState<Item[]>(() =>
    photos.map((photo) => ({ key: photo.src, src: photo.src, file: null, alt: photo.alt, thumb: photo.thumb })),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const made = useRef(0);
  const inputId = `${prefix}-photos`;

  // Words the same as the last ones gain or lose a no-break space at the end, so the status line changes and a screen
  // reader says them again.
  const say = (words: string) => setStatus((last) => (last.endsWith("\u00a0") ? words : `${words}\u00a0`));
  const tokenOf = (item: Item) => item.src ?? newPhotoToken(files.indexOf(item.file!));

  /** Puts these files in the file input, so the plain form posts them. */
  function putInInput(next: readonly File[]) {
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.currentTarget.files ?? [])];
    // The browser has swapped the input's files for this pick. The files already chosen go straight back, so a save
    // while these are made ready posts only files the list names; these join them once they're ready.
    putInInput(files);
    if (busy) {
      say(`${WAIT} Then add more.`);
      return;
    }
    // An empty file is left out, as the server leaves it out, so "new:<n>" means the same file to both. A file of no
    // known type is the server's to check, by its signature.
    const fitting = picked.filter((file) => file.size > 0 && (!file.type || PHOTO_TYPES.includes(file.type as PhotoType)));
    const taken = fitting.slice(0, Math.max(0, PHOTOS_PER_LISTING - items.length));
    setBusy(true);
    say("Getting your photos ready…");
    // One at a time, so only one photo is ever decoded in memory.
    const shrunk: File[] = [];
    for (const file of taken) shrunk.push(await shrink(file));
    const nextFiles = [...files, ...shrunk];
    putInInput(nextFiles);
    setFiles(nextFiles);
    const added = shrunk.map((file) => {
      made.current += 1;
      return { key: `new-${made.current}`, src: null, file, alt: "", thumb: URL.createObjectURL(file) };
    });
    setItems([...items, ...added]);
    setBusy(false);
    say(pickedMessage(taken.length, picked.length - fitting.length, fitting.length - taken.length));
  }

  function press(event: MouseEvent<HTMLButtonElement>, item: Item, op: PhotoOp) {
    // With this code running, the buttons work here rather than posting the form (plan decision 9).
    event.preventDefault();
    // While picked photos are being made ready, the list stays as it is, so they land after the photos it shows.
    if (busy) {
      say(WAIT);
      return;
    }
    const from = items.indexOf(item);
    const keys = applyPhotoMove(
      items.map((each) => each.key),
      { token: item.key, op },
    );
    const next = keys.map((key) => items.find((each) => each.key === key)!);
    if (op === "remove" && item.file) {
      const nextFiles = files.filter((file) => file !== item.file);
      putInInput(nextFiles);
      setFiles(nextFiles);
    }
    // The list is drawn at once, so focus can move to the photo's new place.
    flushSync(() => setItems(next));
    const rows = [...(listRef.current?.children ?? [])] as HTMLElement[];
    if (op === "remove") {
      say(`Photo removed. ${next.length} left.`);
      // Focus goes to the photo that took its place (or the one before it), or to Add photos when none is left.
      (rows[Math.min(from, rows.length - 1)]?.querySelector("button") ?? inputRef.current)?.focus();
      return;
    }
    const at = keys.indexOf(item.key);
    say(at === 0 ? "That photo is the cover now." : `Moved to photo ${at + 1} of ${next.length}.`);
    // Focus stays with the photo: on the same button if it still has it, otherwise on its first.
    const row = rows.find((each) => each.dataset.key === item.key);
    (row?.querySelector<HTMLButtonElement>(`[data-op="${op}"]`) ?? row?.querySelector("button"))?.focus();
  }

  return (
    <fieldset className="form-field sell-fieldset">
      <legend className="form-label">Photos</legend>
      <p id={`${prefix}-photos-hint`} className="form-hint">
        Up to {PHOTOS_PER_LISTING} JPG, PNG or WebP photos, {PHOTO_MAX_MB} MB each. The first is the cover. We make
        them smaller and remove hidden data such as your location. If someone else is in a photo, ask them first.
      </p>
      <FieldError id={`${prefix}-photos-error`} message={error} />
      {items.length > 0 && (
        <>
          <p id={`${prefix}-alt-hint`} className="form-hint">
            {/* ALT_MAX, written out: lib/selling/rules.ts would bring more code to the browser. */}
            Describe each photo for people who can&apos;t see it. Up to 125 characters. Leave it empty to use the
            title.
          </p>
          <ol ref={listRef} className="sell-photos">
            {items.map((item, index) => {
              const token = tokenOf(item);
              const altId = `${prefix}-alt-${index + 1}`;
              const shown = BUTTONS.filter(
                ({ op }) => (index > 0 || (op !== "cover" && op !== "earlier")) && (index < items.length - 1 || op !== "later"),
              );
              return (
                <li key={item.key} data-key={item.key} className="sell-photo">
                  <input type="hidden" name="photo" value={token} />
                  {/* A new photo's object address is let go once it's drawn; the picture stays. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- a blob or /_next/image address (plan decision 13). */}
                  <img
                    src={item.thumb}
                    alt=""
                    width={96}
                    height={96}
                    onLoad={item.file ? () => URL.revokeObjectURL(item.thumb) : undefined}
                    className="sell-thumb"
                  />
                  <div className="sell-photo-body">
                    <p className="sell-photo-title">
                      Photo {index + 1}
                      {index === 0 && " (the cover)"}
                    </p>
                    <label htmlFor={altId} className="form-label">
                      Describe photo {index + 1}
                    </label>
                    <input
                      id={altId}
                      name={`alt:${token}`}
                      type="text"
                      defaultValue={item.alt}
                      autoComplete="off"
                      aria-describedby={`${prefix}-alt-hint`}
                      className="form-input"
                    />
                    <div className="sell-photo-buttons">
                      {shown.map(({ op, label }) => (
                        <button
                          key={op}
                          type="submit"
                          name="photoMove"
                          value={`${token}:${op}`}
                          data-op={op}
                          onClick={(event) => press(event, item, op)}
                          className={cx("sell-action", op === "remove" && "sell-action-danger")}
                        >
                          {label} <span className="sr-only">(photo {index + 1})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <label htmlFor={inputId} className="form-label">
        Add photos
      </label>
      <input
        ref={inputRef}
        id={inputId}
        name="newPhotos"
        type="file"
        multiple
        accept={PHOTO_ACCEPT}
        onChange={pick}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${prefix}-photos-hint`, error && `${prefix}-photos-error`)}
        className="form-input sell-file"
      />
      <p role="status" className="sell-photo-status">
        {status}
      </p>
    </fieldset>
  );
}
