import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from "@/lib/markdown";

function renderInline(parts: readonly MarkdownInline[]): ReactNode[] {
  return parts.map((part, index) => {
    if (part.type === "text") return <Fragment key={index}>{part.text}</Fragment>;
    if (part.type === "strong") return <strong key={index}>{renderInline(part.children)}</strong>;
    if (part.type === "em") return <em key={index}>{renderInline(part.children)}</em>;
    // Only paths on this site get this far (lib/markdown.ts). No prefetch: a post's links are rarely followed.
    return (
      <Link key={index} href={part.href} prefetch={false}>
        {renderInline(part.children)}
      </Link>
    );
  });
}

function renderBlock(block: MarkdownBlock, index: number, headingLevel: 2 | 3): ReactNode {
  if (block.type === "heading") {
    const Heading = headingLevel === 3 ? "h3" : "h2";
    return <Heading key={index}>{renderInline(block.children)}</Heading>;
  }
  if (block.type === "paragraph") return <p key={index}>{renderInline(block.children)}</p>;
  const items = block.items.map((item, n) => <li key={n}>{renderInline(item)}</li>);
  return block.type === "bullets" ? <ul key={index}>{items}</ul> : <ol key={index}>{items}</ol>;
}

/**
 * A Hub post's body (community spec decision 9): the markdown subset, turned into React elements on the server. Text
 * is never read as HTML, so anything that looks like a tag shows as written. Headings are h2s, under the page's h1,
 * unless `headingLevel` says 3: the staff Preview sits under its own h2, "Preview" (staff tools amendment 15.6).
 */
export function Markdown({
  source,
  className,
  headingLevel = 2,
}: {
  source: string;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  return (
    <div className={cx("markdown", className)}>
      {parseMarkdown(source).map((block, index) => renderBlock(block, index, headingLevel))}
    </div>
  );
}
