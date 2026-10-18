import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPostRow } from "@/lib/data/hub-posts";
import { resetSampleStore } from "@/lib/data/store";
import { NEW_POST_VALUES, PostEditor, postValues } from "./PostEditor";

vi.mock("@/lib/staff/hub-actions", () => ({ savePost: async () => {} }));

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

beforeEach(() => {
  resetSampleStore();
});

describe("the post editor (staff tools spec 2.4)", () => {
  it("starts a new post as a published tip for every campus, with every field the spec names", () => {
    render(
      <PostEditor postId={null} values={NEW_POST_VALUES} errors={[]} preview={null} campuses={campuses} coverSrc={null} />,
    );
    const kinds = screen.getByRole("group", { name: "Kind" });
    expect(within(kinds).getByRole("radio", { name: "Tip" })).toBeChecked();
    expect(within(kinds).getByRole("radio", { name: "Event" })).toHaveAccessibleDescription(
      "A date, a place and a number of places. Students RSVP.",
    );
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("Up to 70 characters.");
    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("all");
    for (const label of [
      "Date",
      "Start time",
      "Place",
      "Places (events only)",
      "Summary",
      "The post",
      "Cover photo (optional)",
    ]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Start time")).toHaveAttribute("type", "time");
    expect(screen.getByLabelText("Cover photo (optional)")).toHaveAttribute("type", "file");
    expect(screen.getByRole("checkbox", { name: /^Published/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save the post" })).toHaveAttribute("value", "save");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("value", "preview");
    expect(document.querySelector('input[name="post"]')).toHaveValue("");
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
    expect(document.querySelector("form")).toHaveAttribute("novalidate");
  });

  it("fills in an existing post, its date and time in SAST", async () => {
    const values = postValues((await getPostRow("h-002"))!);
    render(
      <PostEditor
        postId="h-002"
        values={values}
        errors={[]}
        preview={null}
        campuses={campuses}
        coverSrc="/placeholders/hub/h-002.svg"
      />,
    );
    expect(screen.getByRole("radio", { name: "Office hours" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toHaveValue("Office hours: pricing your hustle");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-15");
    expect(screen.getByLabelText("Start time")).toHaveValue("13:00");
    expect(screen.getByLabelText("Place")).toHaveValue("The Hub, Block C");
    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("midrand");
    expect(document.querySelector('input[name="post"]')).toHaveValue("h-002");
    expect(screen.getByRole("link", { name: "See the cover now" })).toHaveAttribute("href", "/placeholders/hub/h-002.svg");
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "edit-h-002-title");
  });

  it("fills in a draft event with its places, and an unpublished post unticked", async () => {
    const row = (await getPostRow("h-001"))!;
    const values = postValues({ ...row, published: false });
    render(
      <PostEditor postId="h-001" values={values} errors={[]} preview={null} campuses={campuses} coverSrc={null} />,
    );
    expect(screen.getByRole("radio", { name: "Event" })).toBeChecked();
    expect(screen.getByLabelText("Places (events only)")).toHaveValue("80");
    expect(screen.getByRole("checkbox", { name: /^Published/ })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("all");
  });

  it("shows the body rendered above the form after Preview, and keeps a picked cover for the save", () => {
    const values = { ...NEW_POST_VALUES, body: "## Bring\n- A table", cover: "/photos/ph-00000000-0000-4000-8000-000000000000" };
    render(
      <PostEditor postId={null} values={values} errors={[]} preview={values.body} campuses={campuses} coverSrc={null} />,
    );
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(preview).toHaveAttribute("id", "new-post-preview");
    expect(within(preview).getByRole("heading", { level: 3, name: "Bring" })).toBeInTheDocument();
    expect(within(preview).getByRole("listitem")).toHaveTextContent("A table");
    expect(document.querySelector('input[name="keepCover"]')).toHaveValue(values.cover);
    expect(screen.getByRole("link", { name: "see it" })).toHaveAttribute("href", values.cover);
  });

  it("shows typed words as text in the preview, never as markup", () => {
    const body = "<script>alert(1)</script> and **bold**";
    render(
      <PostEditor
        postId={null}
        values={{ ...NEW_POST_VALUES, body }}
        errors={[]}
        preview={body}
        campuses={campuses}
        coverSrc={null}
      />,
    );
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(preview.querySelector("script")).toBeNull();
    expect(preview).toHaveTextContent("<script>alert(1)</script> and bold");
  });

  it("says so when Preview is pressed on an empty post", () => {
    render(<PostEditor postId={null} values={NEW_POST_VALUES} errors={[]} preview="" campuses={campuses} coverSrc={null} />);
    expect(within(screen.getByRole("region", { name: "Preview" })).getByText("There is nothing to preview yet.")).toBeInTheDocument();
  });

  it("says what's wrong at the top and by each field", () => {
    const errors = [
      { message: "Give the post a title.", fieldId: "new-post-title" },
      { message: "Choose a tip, an event or office hours.", fieldId: "new-post-kind-tip" },
    ];
    render(
      <PostEditor
        postId={null}
        values={{ ...NEW_POST_VALUES, kind: "" }}
        errors={errors}
        preview={null}
        campuses={campuses}
        coverSrc={null}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("group", { name: "Kind" })).toHaveAccessibleDescription(
      "Error: Choose a tip, an event or office hours.",
    );
  });

  it("gives its error summary an id of its own, apart from the Summary field's", () => {
    const errors = [{ message: "Write a one-sentence summary.", fieldId: "edit-h-002-summary" }];
    render(
      <PostEditor postId="h-002" values={{ ...NEW_POST_VALUES }} errors={errors} preview={null} campuses={campuses} coverSrc={null} />,
    );
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary.id).not.toBe("edit-h-002-summary");
    expect(document.querySelectorAll("#edit-h-002-summary")).toHaveLength(1);
    expect(screen.getByLabelText("Summary")).toHaveAttribute("aria-invalid", "true");
  });

  it("carries the new post's one-time token in a hidden field, and an edit carries none (amendment 15.7)", async () => {
    const token = "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55";
    const { unmount } = render(
      <PostEditor postId={null} values={NEW_POST_VALUES} errors={[]} preview={null} campuses={campuses} coverSrc={null} once={token} />,
    );
    expect(document.querySelector('input[name="once"]')).toHaveAttribute("type", "hidden");
    expect(document.querySelector('input[name="once"]')).toHaveValue(token);
    unmount();
    // Nobody signed in has no token to draw, and the form posts none.
    render(
      <PostEditor postId={null} values={NEW_POST_VALUES} errors={[]} preview={null} campuses={campuses} coverSrc={null} once={null} />,
    );
    expect(document.querySelector('input[name="once"]')).toBeNull();
    document.body.innerHTML = "";
    render(
      <PostEditor
        postId="h-002"
        values={postValues((await getPostRow("h-002"))!)}
        errors={[]}
        preview={null}
        campuses={campuses}
        coverSrc={null}
        once={token}
      />,
    );
    expect(document.querySelector('input[name="once"]')).toBeNull();
  });

  it("sets headings under the Preview's own h2 (amendment 15.6)", () => {
    const body = "## Bring\n\nA table.";
    render(
      <PostEditor postId={null} values={{ ...NEW_POST_VALUES, body }} errors={[]} preview={body} campuses={campuses} coverSrc={null} />,
    );
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByRole("heading", { level: 2, name: "Preview" })).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { level: 3, name: "Bring" })).toBeInTheDocument();
    expect(within(preview).getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });
});

/** [ids, classes and pseudo-classes, elements]: a selector's specificity, `:not(x)` counting as `x` does. */
function specificity(selector: string): [number, number, number] {
  const flat = selector.replace(/:not\(([^)]*)\)/g, " $1 ");
  const ids = flat.match(/#[\w-]+/g)?.length ?? 0;
  const classes = flat.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g)?.length ?? 0;
  const bare = flat.replace(/\.[\w-]+|#[\w-]+|\[[^\]]*\]|::?[\w-]+/g, " ");
  return [ids, classes, bare.match(/[a-zA-Z][\w-]*/g)?.length ?? 0];
}

function outranks(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** Every `selector { declarations }` in the stylesheet, comments gone. The file's rules sit one level inside @layer. */
function cssRules(css: string): { selectors: string[]; body: string }[] {
  const rules: { selectors: string[]; body: string }[] = [];
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selectors: match[1].split(",").map((selector) => selector.trim()), body: match[2] });
  }
  return rules;
}

describe("the Preview's colours (amendment 15.1)", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const rules = cssRules(css);

  it("paints a link in a Preview paragraph navy: its rule outranks the staff text-link rule, whatever the order", () => {
    // The staff text-link rule paints a link in any paragraph sky-dark, which is under 4.5:1 on the Preview's pale.
    const staffLink = rules
      .flatMap((rule) => rule.selectors)
      .find((selector) => selector.startsWith(".staff-body p a:not(.btn)"));
    expect(staffLink).toBeDefined();
    const isPreviewLink = (selector: string) =>
      selector.includes(".staff-preview") && selector.includes(".markdown") && /(^|\s)a(?![\w-])/.test(selector);
    const navy = rules.filter(
      (rule) => /^color:\s*var\(--color-navy\);?$/.test(rule.body.trim()) && rule.selectors.some(isPreviewLink),
    );
    expect(navy).toHaveLength(1);
    // The Preview sits inside .staff-body, so a selector for a link in its paragraphs must beat the staff rule's.
    const selector = navy[0].selectors.find(isPreviewLink)!;
    expect(outranks(specificity(selector), specificity(staffLink!)), `${selector} vs ${staffLink}`).toBe(true);
  });
});
