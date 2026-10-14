import { describe, expect, it } from "vitest";
import { markdownText, parseInline, parseMarkdown } from "./markdown";

const text = (value: string) => ({ type: "text", text: value });

describe("parseInline (community spec decision 9)", () => {
  it("keeps plain words as they are", () => {
    expect(parseInline("Plain words")).toEqual([text("Plain words")]);
  });

  it("finds bold and italic", () => {
    expect(parseInline("Price it **fairly**, not *cheaply*.")).toEqual([
      text("Price it "),
      { type: "strong", children: [text("fairly")] },
      text(", not "),
      { type: "em", children: [text("cheaply")] },
      text("."),
    ]);
  });

  it("keeps links to paths on this site", () => {
    expect(parseInline("See [the safety tips](/safety) first.")).toEqual([
      text("See "),
      { type: "link", href: "/safety", children: [text("the safety tips")] },
      text(" first."),
    ]);
    expect(parseInline("[office hours](/hub?type=office-hours)")).toEqual([
      { type: "link", href: "/hub?type=office-hours", children: [text("office hours")] },
    ]);
  });

  it("drops links that lead off the site, keeping their words", () => {
    const source =
      "Read [this](https://evil.example) and [that](//evil.example) and [x](javascript:alert) and [y](/\\evil.example).";
    expect(parseInline(source)).toEqual([text("Read this and that and x and y.")]);
  });

  it("leaves stray stars alone", () => {
    expect(parseInline("2 * 3 * 4 and ** loose **")).toEqual([text("2 * 3 * 4 and ** loose **")]);
  });

  it("allows a link inside bold", () => {
    expect(parseInline("**Bold with [a link](/sell)**")).toEqual([
      { type: "strong", children: [text("Bold with "), { type: "link", href: "/sell", children: [text("a link")] }] },
    ]);
  });

  it("treats HTML as plain text", () => {
    expect(parseInline("<b>hi</b> <script>alert(1)</script>")).toEqual([text("<b>hi</b> <script>alert(1)</script>")]);
  });
});

describe("parseMarkdown (community spec decision 9)", () => {
  it("runs lines together into a paragraph until a blank line", () => {
    expect(parseMarkdown("First line\nsame paragraph\n\nSecond paragraph")).toEqual([
      { type: "paragraph", children: [text("First line same paragraph")] },
      { type: "paragraph", children: [text("Second paragraph")] },
    ]);
  });

  it("reads ## headings, - bullets and 1. numbers", () => {
    expect(parseMarkdown("## A heading\n- one\n- two\n\n1. first\n2. second\nAfter the list")).toEqual([
      { type: "heading", children: [text("A heading")] },
      { type: "bullets", items: [[text("one")], [text("two")]] },
      { type: "numbers", items: [[text("first")], [text("second")]] },
      { type: "paragraph", children: [text("After the list")] },
    ]);
  });

  it("starts a new list when the kind of item changes", () => {
    expect(parseMarkdown("- a\n1. b")).toEqual([
      { type: "bullets", items: [[text("a")]] },
      { type: "numbers", items: [[text("b")]] },
    ]);
  });

  it("treats other hashes as text, and Windows line endings like any others", () => {
    expect(parseMarkdown("# Not a heading\n### Nor this")).toEqual([
      { type: "paragraph", children: [text("# Not a heading ### Nor this")] },
    ]);
    expect(parseMarkdown("\r\n\r\nHello\r\nthere\r\n")).toEqual([{ type: "paragraph", children: [text("Hello there")] }]);
  });

  it("has nothing for an empty body", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});

describe("markdownText", () => {
  it("gives a body as plain words, for its page's description (community spec 5.2)", () => {
    expect(markdownText("## Start here\nPrice it **fairly**.\n\n- one\n- [two](/sell)")).toBe(
      "Start here Price it fairly. one two",
    );
  });
});
