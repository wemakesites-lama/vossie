import { safeNextPath } from "./next-path";

/** Text inside a block of a Hub post (community spec decision 9). */
export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "em"; children: MarkdownInline[] }
  | { type: "link"; href: string; children: MarkdownInline[] };

/** A block of a Hub post: a "## " heading, a paragraph, or a list of "- " bullets or "1. " numbers. */
export type MarkdownBlock =
  | { type: "heading"; children: MarkdownInline[] }
  | { type: "paragraph"; children: MarkdownInline[] }
  | { type: "bullets"; items: MarkdownInline[][] }
  | { type: "numbers"; items: MarkdownInline[][] };

/**
 * The most characters of a body the parser reads; whatever comes after is dropped before parsing. The inline matcher
 * is quadratic on a long line with many unclosed markers (100,000 characters took about four seconds), and nothing
 * stops a long body today except the sample data. Once staff can write posts (stage G), this keeps one post from
 * stalling the server. The sample bodies are well under 4,000.
 */
export const MAX_MARKDOWN_LENGTH = 8000;

// **bold**, *italic* and [words](/path). A marker needs a character other than a space or "*" just inside it, as in
// Markdown, so "2 * 3 * 4" and "** loose **" stay as written. A link's address may hold one level of balanced
// parentheses, so "[menu](/browse?q=(x))" is one link and "[click](javascript:alert(1))" is one dropped link, not a
// link cut at the first ")" with a stray ")" left in the text.
const INLINE =
  /\*\*([^\s*](?:.*?[^\s*])?)\*\*|\*([^\s*](?:.*?[^\s*])?)\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g;
const HEADING = /^## +(.+)$/;
const BULLET = /^- +(.+)$/;
const NUMBERED = /^\d{1,3}\. +(.+)$/;

/** Add a part, joining it to the text before it, so a dropped link's words run on with the text around them. */
function push(parts: MarkdownInline[], part: MarkdownInline): void {
  const last = parts.at(-1);
  if (part.type === "text" && last?.type === "text") last.text += part.text;
  else parts.push(part);
}

/** Bold, italic and links in one run of text. Everything else, HTML included, is plain text. */
export function parseInline(source: string): MarkdownInline[] {
  const text = source.slice(0, MAX_MARKDOWN_LENGTH);
  const parts: MarkdownInline[] = [];
  let end = 0;
  for (const match of text.matchAll(INLINE)) {
    const [whole, bold, italic, words, href] = match;
    if (match.index > end) push(parts, { type: "text", text: text.slice(end, match.index) });
    if (bold !== undefined) push(parts, { type: "strong", children: parseInline(bold) });
    else if (italic !== undefined) push(parts, { type: "em", children: parseInline(italic) });
    else {
      // Only paths on this site stay links (community spec decision 9). safeNextPath refuses whatever would lead off
      // the site ("https://…", "//…", "/\…", "javascript:…"); the words stay, without the link.
      const path = safeNextPath(href);
      const children = parseInline(words);
      if (path === null) children.forEach((child) => push(parts, child));
      else push(parts, { type: "link", href: path, children });
    }
    end = match.index + whole.length;
  }
  if (end < text.length) push(parts, { type: "text", text: text.slice(end) });
  return parts;
}

type List = { type: "bullets" | "numbers"; items: MarkdownInline[][] };

/**
 * A Hub post's body as blocks (community spec decision 9). Lines run together into a paragraph until a blank line;
 * "## " starts a heading, "- " a bullet and "1. " a numbered item. Nothing else is special: "# " and "### " lines are
 * plain text.
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  // Typed with "as": the closures below change it, which TypeScript's narrowing can't see.
  let list = null as List | null;

  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const closeList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  // Anything past the limit is dropped before parsing (see MAX_MARKDOWN_LENGTH).
  const lines = source
    .slice(0, MAX_MARKDOWN_LENGTH)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((text) => text.trim());

  for (const line of lines) {
    const heading = HEADING.exec(line);
    const item = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (line === "") {
      closeParagraph();
      closeList();
    } else if (heading) {
      closeParagraph();
      closeList();
      blocks.push({ type: "heading", children: parseInline(heading[1]) });
    } else if (item) {
      const type = line.startsWith("-") ? "bullets" : "numbers";
      closeParagraph();
      if (list?.type !== type) closeList();
      list ??= { type, items: [] };
      list.items.push(parseInline(item[1]));
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  closeParagraph();
  closeList();
  return blocks;
}

function inlineText(parts: readonly MarkdownInline[]): string {
  return parts.map((part) => (part.type === "text" ? part.text : inlineText(part.children))).join("");
}

/** A post's body as plain words, for its page's description (community spec 5.2). */
export function markdownText(source: string): string {
  return parseMarkdown(source)
    .map((block) =>
      block.type === "bullets" || block.type === "numbers"
        ? block.items.map(inlineText).join(" ")
        : inlineText(block.children),
    )
    .join(" ");
}
