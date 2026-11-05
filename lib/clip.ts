// One line of text cut to a length at a word (AI round two: Shop coach's titles and whys, I1 planning decision 19).
// The model is asked for a length but can't count characters (the report read's lesson, 2026-11-04), so text is cut,
// never refused. Pure.

/** `text` with its whitespace collapsed, cut to at most `max` characters at a word, with "…" when cut. */
export function clipAtWord(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (Array.from(line).length <= max) return line;
  const room = Array.from(line).slice(0, max - 1).join("");
  const cut = room.lastIndexOf(" ");
  return `${(cut > max / 2 ? room.slice(0, cut) : room).replace(/[\s,;:.-]+$/, "")}…`;
}
