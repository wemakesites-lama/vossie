"use client";

import { useRef, useState, type ChangeEvent, type InputHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ShrinkTo } from "@/lib/photos/shrink";
import { applyPhotoMove, newPhotoToken, type PhotoOp } from "@/lib/selling/photo-order";

/** A photo the server already has: its address, its description ("" means the title) and its small picture's address. */
export type SavedPhoto = { src: string; alt: string; thumb: string };

/** A photo on the form: a saved one (`src`), or a new one waiting in the file input (`file`). */
type Item = { key: string; src: string | null; file: File | null; alt: string; thumb: string };

/** One of each photo's buttons: what it does, its words and its look. */
export type PhotoButton = { op: PhotoOp; label: string; className: string };

/** One way of saying something for one photo, then for more: "1 photo added." and "{n} photos added." */
type Counted = readonly [one: string, more: string];

/**
 * What the status line says (PhotoFieldset), with {n} for a number of photos, {at} for a photo's place and {max} for
 * the most a listing takes.
 */
export type PhotoWords = {
  cover: string;
  moved: string;
  removed: string;
  added: Counted;
  refused: Counted;
  leftOut: Counted;
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
  /** The hint the photos' descriptions point to, shown while there's a photo. */
  altHint: ReactNode;
  /** The file input's label. */
  children: ReactNode;
};

/** The words with their {n}, {at} and {max} filled in. */
const fill = (text: string, values: Record<string, number>) =>
  text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));

/**
 * The listing form's photos, the part that moves (selling spec 2.3, 2.5 and section 4; plan decisions 9 and 10).
 * Every photo has a hidden `photo` field (a saved photo's address, or "new:<n>" for the n-th file in the file input),
 * a description, and Make cover, Move earlier, Move later and Remove as submit buttons. Rendered on the server, that's
 * a form that works without this code: each button posts it. Once the code runs, the buttons work in place, a status
 * line says what happened, and picked photos show at once while lib/photos/shrink.ts, loaded the first time a photo
 * is picked, shrinks them in the background.
 */
export function PhotoField(props: PhotoFieldProps) {
  const { prefix, photos, max, shrinkTo, buttons, words, input, altHint, children } = props;
  const [items, setItems] = useState<Item[]>(() =>
    photos.map((photo) => ({ key: photo.src, src: photo.src, file: null, alt: photo.alt, thumb: photo.thumb })),
  );
  const [status, setStatus] = useState("");
  // The photos as last shown, for the handlers, including the shrinking that finishes after a pick.
  const latest = useRef(items);
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
    if (inputRef.current) inputRef.current.files = transfer.files;
    flushSync(() => setItems(next));
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    // The browser has swapped the input's files for this pick; show() puts every new photo's file back.
    const picked = [...(event.currentTarget.files ?? [])];
    const types = input.accept.split(",");
    const fitting = picked.filter((file) => types.includes(file.type));
    const taken = fitting.slice(0, Math.max(0, max - latest.current.length));
    // A new photo's preview is an object URL, unique to it, so it is the photo's key too.
    show([
      ...latest.current,
      ...taken.map((file) => {
        const thumb = URL.createObjectURL(file);
        return { key: thumb, src: null, file, alt: "", thumb };
      }),
    ]);
    // "2 photos added. 1 wasn't a JPG, PNG or WebP.", saying only what happened.
    const counts: Array<[Counted, number]> = [
      [words.added, taken.length],
      [words.refused, picked.length - fitting.length],
      [words.leftOut, fitting.length - taken.length],
    ];
    setStatus(
      counts
        .filter(([, n]) => n > 0)
        .map(([[one, more], n]) => fill(n === 1 ? one : more, { n, max }))
        .join(" "),
    );
    if (taken.length === 0) return;
    // Until the shrunk copies are ready, the originals wait in the input. If the code can't load, they go as they
    // are, and the server checks and strips them, as it does without JavaScript (plan decisions 10 and 11).
    import("@/lib/photos/shrink")
      .then(({ shrink }) => Promise.all(taken.map((file) => shrink(file, shrinkTo))))
      .then(
        (shrunk) =>
          show(
            latest.current.map((item) => {
              const at = item.file ? taken.indexOf(item.file) : -1;
              return at === -1 ? item : { ...item, file: shrunk[at] };
            }),
          ),
        () => {},
      );
  }

  function press(event: MouseEvent<HTMLButtonElement>, key: string, op: PhotoOp) {
    // With this code running, the buttons work here rather than posting the form (plan decision 9).
    event.preventDefault();
    const now = latest.current;
    const from = now.findIndex((each) => each.key === key);
    const keys = applyPhotoMove(
      now.map((each) => each.key),
      { token: key, op },
    );
    // A saved photo's thumb isn't an object URL; revoking it does nothing.
    if (op === "remove") URL.revokeObjectURL(now[from].thumb);
    show(keys.map((each) => now.find((item) => item.key === each)!));
    if (op === "remove") {
      setStatus(fill(words.removed, { n: keys.length }));
      const rows = listRef.current?.querySelectorAll("li") ?? [];
      (rows[Math.min(from, rows.length - 1)]?.querySelector("button") ?? inputRef.current)?.focus();
      return;
    }
    const at = keys.indexOf(key);
    setStatus(at === 0 ? words.cover : fill(words.moved, { at: at + 1, n: keys.length }));
    // Focus stays with the photo: on the same button if it still has it, otherwise on its first.
    const row = listRef.current?.querySelector(`[data-key="${key}"]`);
    (row?.querySelector<HTMLButtonElement>(`[data-op="${op}"]`) ?? row?.querySelector("button"))?.focus();
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
                <li key={item.key} data-key={item.key} className="sell-photo">
                  <input type="hidden" name="photo" value={token} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- a blob or /_next/image address (plan decision 13). */}
                  <img src={item.thumb} alt="" width={96} height={96} className="sell-thumb" />
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
                      {shown.map(({ op, label, className }) => (
                        <button
                          key={op}
                          type="submit"
                          name="photoMove"
                          value={`${token}:${op}`}
                          data-op={op}
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
      <input ref={inputRef} type="file" multiple onChange={pick} {...input} />
      <p role="status" className="sell-photo-status">
        {status}
      </p>
    </>
  );
}
