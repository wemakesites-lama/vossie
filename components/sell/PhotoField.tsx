"use client";

import { useRef, useState, type ChangeEvent, type InputHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ShrinkTo } from "@/lib/photos/shrink";
import { newPhotoToken, type PhotoOp } from "@/lib/selling/photo-order";

/**
 * A photo the server already has: its address, its description ("" means the title), its small picture's address, and
 * whether its description is the first that's too long, where that error links (amendment 11.5).
 */
export type SavedPhoto = { src: string; alt: string; thumb: string; invalid?: boolean };

/** A photo on the form: a saved one (`src`), or a new one waiting in the file input (`file`), with no description yet. */
type Item = Partial<SavedPhoto> & { key: string; thumb: string; file?: File };

/** One of each photo's buttons: what it does, its words and its look. */
export type PhotoButton = { op: PhotoOp; label: string; className: string };

/** One way of saying something for one photo, then for more: "1 photo added." and "{n} photos added." */
type Counted = readonly [one: string, more: string];

/**
 * What the status line says (PhotoFieldset), with {n} for a number of photos, {at} for a photo's place and {max} for
 * the most a listing takes. `busy` and `ready`: while picked photos are shrunk, and once they all are (amendment 11.1).
 */
export type PhotoWords = {
  cover: string;
  moved: string;
  removed: string;
  added: Counted;
  refused: Counted;
  leftOut: Counted;
  busy: Counted;
  ready: Counted;
};

type PhotoFieldProps = {
  /** The form's id prefix (plan decision 23): "new" or "edit-<id>". */
  prefix: string;
  photos: readonly SavedPhoto[];
  /** Photos per listing, the cover included. */
  max: number;
  /** How lib/photos/shrink.ts shrinks a picked photo (selling spec 2.3). */
  shrinkTo: ShrinkTo;
  /** Each photo's buttons, in order (PhotoFieldset): Make cover, Move earlier, Move later and Remove. */
  buttons: readonly PhotoButton[];
  words: PhotoWords;
  /** The file input's id, name, accepted types, description and class, worked out on the server (PhotoFieldset). */
  input: InputHTMLAttributes<HTMLInputElement> & { id: string; accept: string };
  /** What every photo's description field has: its type, the hint it points to and its class (PhotoFieldset). */
  altInput: InputHTMLAttributes<HTMLInputElement>;
  /** The hint the photos' descriptions point to, shown while there's a photo. */
  altHint: ReactNode;
  /** The file input's label. */
  children: ReactNode;
};

/** The words with their {n}, {at} and {max} filled in. */
const fill = (text: string, values: Record<string, number>) =>
  text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));

/** How long a save waits for photos being shrunk before it goes with whatever the file input holds (amendment 11.1). */
const HOLD_MS = 15_000;

/** What `busy` holds while a save waits: another press is held too, so the form isn't sent twice. */
const HELD = true;

/**
 * The listing form's photos, the part that moves (selling spec 2.3, 2.5 and section 4; plan decisions 9 and 10).
 * Every photo has a hidden `photo` field (a saved photo's address, or "new:<n>" for the n-th file in the file input),
 * a description, and Make cover, Move earlier, Move later and Remove as submit buttons. Rendered on the server, that's
 * a form that works without this code: each button posts it. Once the code runs, the buttons work in place, a status
 * line says what happened, and picked photos show at once while lib/photos/shrink.ts, loaded the first time a photo
 * is picked, shrinks them in the background, one at a time; a save waits for them (amendment 11.1).
 */
export function PhotoField(props: PhotoFieldProps) {
  const { prefix, photos, max, shrinkTo, buttons, words, input, altInput, altHint, children } = props;
  const [items, setItems] = useState<Item[]>(() => photos.map((photo) => ({ ...photo, key: photo.src })));
  const [status, setStatus] = useState("");
  // The photos as last shown, for the handlers, including the shrinking that finishes after a pick.
  const latest = useRef(items);
  // The shrinking still to finish, as one promise; HELD while a save waits for it; null once it's done.
  const busy = useRef<Promise<void> | typeof HELD | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const newOnes = items.filter((item) => item.file);

  /**
   * Shows these photos in this order, and puts the new ones' files in the file input in the same order, so the plain
   * form posts them and "new:<n>" is always the n-th.
   */
  function show(next: Item[]) {
    latest.current = next;
    const transfer = new DataTransfer();
    for (const item of next) if (item.file) transfer.items.add(item.file);
    // The input is always there once the field has drawn, which is before anything calls this.
    inputRef.current!.files = transfer.files;
    flushSync(() => setItems(next));
  }

  /** Puts this on the status line, emptied first, so words said twice in a row are announced again (amendment 11.8). */
  function say(text: string) {
    flushSync(() => setStatus(""));
    setStatus(text);
  }

  /** "1 photo added." or "2 photos added.": the words for this many photos. */
  const count = ([one, more]: Counted, n: number) => fill(n === 1 ? one : more, { n, max });

  function pick(event: ChangeEvent<HTMLInputElement>) {
    // The browser has swapped the input's files for this pick; show() puts every new photo's file back.
    const picked = [...(event.currentTarget.files ?? [])];
    // Only a file the browser names as something else is left out. One with no type, or an odd name for one of ours
    // (image/jpg), goes to the server, which knows a photo by its first bytes (amendment 11.7).
    const fitting = picked.filter((file) => /^$|jpe?g|png|webp/.test(file.type));
    const taken = fitting.slice(0, Math.max(0, max - latest.current.length));
    // A new photo's preview is an object URL, unique to it, so it is the photo's key too.
    show([
      ...latest.current,
      ...taken.map((file) => {
        const thumb = URL.createObjectURL(file);
        return { key: thumb, file, thumb };
      }),
    ]);
    // "2 photos added. 1 wasn't a JPG, PNG or WebP. Getting your photos ready…", saying only what happened.
    const counts: Array<[Counted, number]> = [
      [words.added, taken.length],
      [words.refused, picked.length - fitting.length],
      [words.leftOut, fitting.length - taken.length],
      [words.busy, taken.length],
    ];
    say(
      counts
        .filter(([, n]) => n > 0)
        .map(([counted, n]) => count(counted, n))
        .join(" "),
    );
    if (taken.length === 0) return;
    // One photo at a time, after any picked before, so only one is decoded at once (amendment 11.2). Until its shrunk
    // copy is ready, the original waits in the input. If the code can't load, the originals go as they are, and the
    // server checks and strips them, as it does without JavaScript (plan decisions 10 and 11).
    const run: Promise<void> = Promise.all([busy.current, import("@/lib/photos/shrink")])
      .then(async ([, { shrink }]) => {
        for (const file of taken) {
          const small = await shrink(file, shrinkTo);
          // The preview shows the shrunk copy, so the original's decoded picture can go.
          show(
            latest.current.map((item) =>
              item.file === file ? { ...item, file: small, thumb: URL.createObjectURL(small) } : item,
            ),
          );
        }
      })
      .catch(() => {})
      .then(() => {
        // Said once the last pick's photos are ready, unless a held save has already gone.
        if (busy.current !== run) return;
        busy.current = null;
        say(count(words.ready, taken.length));
      });
    busy.current = run;
  }

  /**
   * The file input's ref, which also holds the form's submit while photos are being shrunk (amendment 11.1): a
   * capture-phase listener on the form, so it runs before React's form action, added here rather than in an effect.
   * The held submit is sent again, with the same button, once the shrunk copies are in the input, or after 15 seconds
   * with whatever the input holds (the server strips originals).
   */
  function attach(element: HTMLInputElement | null) {
    inputRef.current = element;
    const form = element?.form;
    if (!form) return;
    const hold = (event: SubmitEvent) => {
      const shrinking = busy.current;
      if (!shrinking) return;
      event.preventDefault();
      if (shrinking === HELD) return;
      busy.current = HELD;
      Promise.race([shrinking, new Promise((go) => setTimeout(go, HOLD_MS))]).then(() => {
        busy.current = null;
        form.requestSubmit(event.submitter);
      });
    };
    form.addEventListener("submit", hold, true);
    return () => form.removeEventListener("submit", hold, true);
  }

  function press(event: MouseEvent<HTMLButtonElement>, key: string, op: PhotoOp) {
    // With this code running, the buttons work here rather than posting the form (plan decision 9).
    event.preventDefault();
    const now = latest.current;
    const from = now.findIndex((each) => each.key === key);
    const next = now.filter((each) => each.key !== key);
    // Each photo shows only the buttons that apply where it is (no Make cover or Move earlier on the first, no Move
    // later on the last), so a move never goes past either end; the server's applyPhotoMove also checks them.
    const to = op === "cover" ? 0 : op === "earlier" ? from - 1 : from + 1;
    if (op !== "remove") next.splice(to, 0, now[from]);
    show(next);
    // The photos' rows as they are now, in order (none once the last is removed).
    const rows = listRef.current?.children ?? [];
    if (op === "remove") {
      say(fill(words.removed, { n: next.length }));
      // Focus goes to the photo now in its place, the one before it if it was the last, or else the file input.
      ((rows[from] ?? rows[from - 1])?.querySelector("button") ?? inputRef.current)?.focus();
      return;
    }
    say(to ? fill(words.moved, { at: to + 1, n: next.length }) : words.cover);
    // Focus stays with the photo, now at `to`: on the same button if it still has it, otherwise on its first.
    const row = rows[to];
    (row.querySelector<HTMLButtonElement>(`[value$=":${op}"]`) ?? row.querySelector("button"))?.focus();
  }

  return (
    <>
      {items.length > 0 && (
        <>
          {altHint}
          <ol ref={listRef} className="sell-photos">
            {items.map((item, index) => {
              const token = item.src ?? newPhotoToken(newOnes.indexOf(item));
              const altId = `${prefix}-alt-${index + 1}`;
              const shown = buttons.filter(
                ({ op }) => (index > 0 || (op !== "cover" && op !== "earlier")) && (index < items.length - 1 || op !== "later"),
              );
              return (
                <li key={item.key} className="sell-photo">
                  <input type="hidden" name="photo" value={token} />
                  {/* A new photo's object URL is let go once its picture has loaded, so none outlives its preview
                      (amendment 11.2). A saved photo's address isn't one, and letting it go does nothing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- a blob or /_next/image address (plan decision 13). */}
                  <img
                    src={item.thumb}
                    alt=""
                    width={96}
                    height={96}
                    className="sell-thumb"
                    onLoad={() => URL.revokeObjectURL(item.thumb)}
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
                      {...altInput}
                      id={altId}
                      name={`alt:${token}`}
                      defaultValue={item.alt}
                      aria-invalid={item.invalid}
                    />
                    <div className="sell-photo-buttons">
                      {shown.map(({ op, label, className }) => (
                        <button
                          key={op}
                          type="submit"
                          name="photoMove"
                          value={`${token}:${op}`}
                          onClick={(event) => press(event, item.key, op)}
                          className={className}
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
      {children}
      <input ref={attach} type="file" multiple onChange={pick} {...input} />
      <p role="status" className="sell-photo-status">
        {status}
      </p>
    </>
  );
}
