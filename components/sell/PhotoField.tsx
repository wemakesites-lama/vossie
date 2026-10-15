"use client";

import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
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

/** One of each photo's buttons: what it does, its words, and its type, name and look (PhotoFieldset). */
export type PhotoButton = ButtonHTMLAttributes<HTMLButtonElement> & { op: PhotoOp; label: string };

/**
 * The fixed attributes of the field's parts, worked out on the server (PhotoFieldset), so none of them is in this
 * component's code: the classes, each photo's hidden field's type and name, its small picture's size, its description
 * field's attributes and those of one marked invalid (amendment 13.4), and the status line's role.
 */
export type PhotoParts = {
  list: HTMLAttributes<HTMLOListElement>;
  photo: HTMLAttributes<HTMLLIElement>;
  hidden: InputHTMLAttributes<HTMLInputElement>;
  img: ImgHTMLAttributes<HTMLImageElement>;
  body: HTMLAttributes<HTMLDivElement>;
  title: HTMLAttributes<HTMLParagraphElement>;
  label: LabelHTMLAttributes<HTMLLabelElement>;
  alt: InputHTMLAttributes<HTMLInputElement>;
  invalidAlt: InputHTMLAttributes<HTMLInputElement>;
  buttons: HTMLAttributes<HTMLDivElement>;
  srOnly: HTMLAttributes<HTMLSpanElement>;
  status: HTMLAttributes<HTMLParagraphElement>;
};

/** One way of saying something for one photo, then for more: "1 photo added." and "{n} photos added." */
type Counted = readonly [one: string, more: string];

/**
 * What the status line says (PhotoFieldset), with {n} for a number of photos, {at} for a photo's place and {max} for
 * the most a listing takes. `busy` and `ready`: while picked photos are shrunk, and once they all are (amendment 11.1);
 * `held`: while a save waits for them (amendment 13.3).
 */
export type PhotoWords = {
  cover: string;
  moved: string;
  removed: string;
  held: string;
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
  /** Every other part's fixed attributes (PhotoFieldset). */
  parts: PhotoParts;
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

/**
 * The listing form's photos, the part that moves (selling spec 2.3, 2.5 and section 4; plan decisions 9 and 10).
 * Every photo has a hidden `photo` field (a saved photo's address, or "new:<n>" for the n-th file in the file input),
 * a description, and Make cover, Move earlier, Move later and Remove as submit buttons. Rendered on the server, that's
 * a form that works without this code: each button posts it. Once the code runs, the buttons work in place, a status
 * line says what happened, and picked photos show at once while lib/photos/shrink.ts, loaded the first time a photo
 * is picked, shrinks them in the background, one at a time; a save waits for them (amendment 11.1).
 */
export function PhotoField(props: PhotoFieldProps) {
  const { prefix, photos, max, shrinkTo, buttons, words, input, parts, altHint, children } = props;
  const [items, setItems] = useState<Item[]>(() => photos.map((photo) => ({ ...photo, key: photo.src })));
  const [status, setStatus] = useState("");
  // The photos as last shown, for the handlers, including the shrinking that finishes after a pick.
  const latest = useRef(items);
  // The shrinking still to finish, as one promise, or null once it's done (amendment 13.1).
  const chain = useRef<Promise<void> | null>(null);
  // While a save waits for it, the last press's submit event, whose button the save goes with; otherwise null.
  const held = useRef<SubmitEvent | null>(null);
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
    say(counts.flatMap(([counted, n]) => (n ? count(counted, n) : [])).join(" "));
    if (taken.length === 0) return;
    // One photo at a time, after any picked before, so only one is decoded at once (amendment 11.2). Until its shrunk
    // copy is ready, the original waits in the input. If the code can't load, the originals go as they are, and the
    // server checks and strips them, as it does without JavaScript (plan decisions 10 and 11).
    const run: Promise<void> = Promise.all([chain.current, import("@/lib/photos/shrink")])
      .then(async ([, { shrink }]) => {
        for (const file of taken) {
          const small = await shrink(file, shrinkTo);
          // The preview shows the shrunk copy, and the original's object URL goes. When the original came back, the
          // preview it has stays (amendment 13.2).
          if (small !== file)
            show(
              latest.current.map((item) => {
                if (item.file !== file) return item;
                URL.revokeObjectURL(item.thumb);
                return { ...item, file: small, thumb: URL.createObjectURL(small) };
              }),
            );
        }
      })
      .catch(() => {})
      .then(() => {
        // Once the last pick's photos are ready, said only when no save is waiting: a held save goes instead.
        if (chain.current !== run) return;
        chain.current = null;
        if (!held.current) say(count(words.ready, taken.length));
      });
    chain.current = run;
  }

  /**
   * The file input's ref, which also holds the form's submit while photos are being shrunk (amendments 11.1 and 13.1):
   * a capture-phase listener on the form, so it runs before React's form action, added here rather than in an effect.
   * A press while a save is held only changes the button it goes with, so the form is sent once. The held save waits
   * for the newest shrinking, photos picked while it waits included, then is sent with the last button pressed (Save
   * as draft pressed while it waits saves a draft); after 15 seconds it goes with whatever the input holds (the server
   * strips originals).
   */
  function attach(element: HTMLInputElement | null) {
    inputRef.current = element;
    const form = element?.form;
    if (!form) return;
    // The newest shrinking's end: a photo picked while a save waits is shrunk after the ones before, so this waits on.
    const shrunk = (): Promise<unknown> | undefined => chain.current?.then(shrunk);
    const hold = (event: SubmitEvent) => {
      if (!chain.current) return;
      event.preventDefault();
      const waiting = held.current;
      held.current = event;
      if (waiting) return;
      say(words.held);
      Promise.race([shrunk(), new Promise((go) => setTimeout(go, HOLD_MS))]).then(() => {
        const { submitter } = held.current!;
        // Nothing is held now, so the submit below goes through, even with a shrink still running after 15 seconds.
        held.current = chain.current = null;
        form.requestSubmit(submitter);
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
    (row.querySelector<HTMLButtonElement>(`button[value$=":${op}"]`) ?? row.querySelector("button"))?.focus();
  }

  return (
    <>
      {items.length > 0 && (
        <>
          {altHint}
          <ol ref={listRef} {...parts.list}>
            {items.map((item, index) => {
              const token = item.src ?? newPhotoToken(newOnes.indexOf(item));
              const altId = `${prefix}-alt-${index + 1}`;
              // A new photo's object URL is let go once its picture has loaded, or couldn't be (amendments 11.2 and
              // 13.2). A saved photo's address isn't one, and letting it go does nothing.
              const free = () => URL.revokeObjectURL(item.thumb);
              const shown = buttons.filter(
                ({ op }) => (index > 0 || (op !== "cover" && op !== "earlier")) && (index < items.length - 1 || op !== "later"),
              );
              return (
                <li key={item.key} {...parts.photo}>
                  <input {...parts.hidden} value={token} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- a blob or /_next/image address (plan decision 13). */}
                  <img {...parts.img} src={item.thumb} alt="" onLoad={free} onError={free} />
                  <div {...parts.body}>
                    <p {...parts.title}>
                      Photo {index + 1}
                      {index === 0 && " (the cover)"}
                    </p>
                    <label htmlFor={altId} {...parts.label}>
                      Describe photo {index + 1}
                    </label>
                    <input
                      {...parts.alt}
                      {...(item.invalid && parts.invalidAlt)}
                      id={altId}
                      name={`alt:${token}`}
                      defaultValue={item.alt}
                    />
                    <div {...parts.buttons}>
                      {shown.map(({ op, label, ...button }) => (
                        <button
                          key={op}
                          {...button}
                          value={`${token}:${op}`}
                          onClick={(event) => press(event, item.key, op)}
                        >
                          {label} <span {...parts.srOnly}>(photo {index + 1})</span>
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
      <p {...parts.status}>{status}</p>
    </>
  );
}
