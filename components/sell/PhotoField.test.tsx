import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedPhoto } from "./PhotoField";
import { PhotoFieldset } from "./PhotoFieldset";

const A = "/photos/ph-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "/placeholders/photo/2.svg";
const C = "/placeholders/photo/3.svg";
const saved = [
  { src: A, alt: "", thumb: "/_next/image?url=a" },
  { src: B, alt: "The back", thumb: B },
  { src: C, alt: "The cover", thumb: C },
];

// jsdom has no DataTransfer and no object URLs; these stand in for the browser's.
class FakeDataTransfer {
  readonly list: File[] = [];
  readonly items = { add: (file: File) => this.list.push(file) };
  get files() {
    return this.list as unknown as FileList;
  }
}

/** The shrunk copy the stand-in for lib/photos/shrink.ts makes: a WebP with the same name. */
const shrunkCopy = (file: File) => new File(["small"], file.name.replace(/\.[^.]*$/, ".webp"), { type: "image/webp" });

// The shrinking code loads with import() the first time a photo is picked. Each test registers its stand-in again,
// which also forgets the last test's copy, so every test's first pick loads it afresh.
const SHRINK = "@/lib/photos/shrink";

beforeEach(() => {
  vi.stubGlobal("DataTransfer", FakeDataTransfer);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: (file: File) => `blob:${file.name}` });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => {} });
  vi.doMock(SHRINK, () => ({ shrink: async (file: File) => shrunkCopy(file) }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock(SHRINK);
});

const tokens = () => [...document.querySelectorAll<HTMLInputElement>('input[name="photo"]')].map((input) => input.value);
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);
const previews = () => [...document.querySelectorAll("img")].map((img) => img.getAttribute("src"));

/** What a save posted: the files in the input as it went, and the button it went with. */
type Post = { files: string[]; intent: string | null };

/** The photos in a form with Save and Save as draft. Returns what the form posts. */
function show(photos: SavedPhoto[] = saved, altError?: string) {
  const posted: Post[] = [];
  render(
    <form
      onSubmit={(event) => {
        // A form action skips a submit that something before it held (prevented), as React's does.
        if (!event.nativeEvent.defaultPrevented) {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          posted.push({ files: names(screen.getByLabelText("Add photos")), intent: submitter?.getAttribute("value") ?? null });
        }
        event.preventDefault();
      }}
    >
      <PhotoFieldset prefix="edit-l-001" photos={photos} error={undefined} altError={altError} />
      <button type="submit" name="intent" value="publish">
        Save
      </button>
      <button type="submit" name="intent" value="draft">
        Save as draft
      </button>
    </form>,
  );
  // jsdom's file input takes only a real FileList, which only a real DataTransfer makes.
  const input = screen.getByLabelText<HTMLInputElement>("Add photos");
  Object.defineProperty(input, "files", { configurable: true, writable: true, value: [] });
  return posted;
}

/**
 * A stand-in for lib/photos/shrink.ts whose shrinks each wait to be let go, in the order they started. `log` says when
 * each started and was let go, so a test can see whether they ran one at a time.
 */
function slowShrink() {
  const started: string[] = [];
  const log: string[] = [];
  const waiting: Array<() => void> = [];
  vi.doMock(SHRINK, () => ({
    shrink: (file: File) => {
      started.push(file.name);
      log.push(`start ${file.name}`);
      return new Promise<File>((resolve) =>
        waiting.push(() => {
          log.push(`done ${file.name}`);
          resolve(shrunkCopy(file));
        }),
      );
    },
  }));
  return { started, log, finish: (index: number) => waiting[index]() };
}

/** Lets any promise chains still running finish, so a second post, if there were one, would have happened. */
const settle = () => new Promise((go) => setTimeout(go, 20));

/** Records every object URL made and freed. */
function objectUrls() {
  const made: string[] = [];
  const freed: string[] = [];
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (file: File) => {
      made.push(`blob:${file.name}`);
      return `blob:${file.name}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: (url: string) => freed.push(url) });
  return { made, freed };
}

/** Picks these files in the file input, as the browser does: they replace whatever it held. */
function pick(files: File[]) {
  const input = screen.getByLabelText<HTMLInputElement>("Add photos");
  Object.defineProperty(input, "files", { configurable: true, writable: true, value: files });
  fireEvent.change(input);
  return input;
}

describe("the photo field (selling spec 2.3, 2.5 and section 4, plan decisions 9 and 10)", () => {
  it("lists the photos in order, the first as the cover, each with its description and buttons that post without JavaScript", () => {
    show();
    expect(tokens()).toEqual([A, B, C]);
    expect(screen.getByText("Photo 1 (the cover)")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).toHaveValue("The back");
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).toHaveAttribute("name", `alt:${B}`);
    expect(screen.queryByRole("button", { name: "Make cover (photo 1)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move later (photo 3)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Make cover (photo 3)" })).toHaveAttribute("value", `${C}:cover`);
    expect(screen.getByRole("button", { name: "Move earlier (photo 2)" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("group", { name: "Photos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add photos")).toHaveAccessibleDescription(/^Up to 6 photos\. The first is the cover\. Ask anyone in a photo first\./);
    // A photo button without JavaScript comes back here, above the photos (amendment 11.4).
    expect(screen.getByText("Photos", { selector: "legend" })).toHaveAttribute("id", "edit-l-001-photos-title");
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).toHaveAccessibleDescription(
      "Optional: describe each photo for people who can't see it.",
    );
  });

  it("moves a photo in place, says so, and keeps focus on it, without posting the form", async () => {
    const user = userEvent.setup();
    const posted = show();
    await user.click(screen.getByRole("button", { name: "Make cover (photo 3)" }));
    expect(tokens()).toEqual([C, A, B]);
    expect(screen.getByRole("status")).toHaveTextContent("That photo is the cover now.");
    expect(document.activeElement?.closest("li")).toBe(screen.getByText("Photo 1 (the cover)").closest("li"));
    await user.click(screen.getByRole("button", { name: "Move later (photo 2)" }));
    expect(tokens()).toEqual([C, B, A]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved to photo 3 of 3.");
    await user.click(screen.getByRole("button", { name: "Move later (photo 1)" }));
    expect(tokens()).toEqual([B, C, A]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved to photo 2 of 3.");
    await user.click(screen.getByRole("button", { name: "Move earlier (photo 2)" }));
    expect(tokens()).toEqual([C, B, A]);
    expect(screen.getByRole("status")).toHaveTextContent("That photo is the cover now.");
    expect(posted).toEqual([]);
  });

  it("removes a photo, and puts focus on the photo now in its place, or the file input when none is left (amendment 11.9)", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Remove (photo 2)" }));
    expect(tokens()).toEqual([A, C]);
    expect(screen.getByRole("status")).toHaveTextContent("Photo removed. 2 left.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Make cover (photo 2)" }));
    // The last photo: focus goes to the one before it.
    await user.click(screen.getByRole("button", { name: "Remove (photo 2)" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove (photo 1)" }));
    await user.click(screen.getByRole("button", { name: "Remove (photo 1)" }));
    expect(tokens()).toEqual([]);
    expect(document.activeElement).toBe(screen.getByLabelText("Add photos"));
  });

  it("announces a status again when it repeats, by clearing it first (amendment 11.8)", async () => {
    const user = userEvent.setup();
    show();
    const status = screen.getByRole("status");
    const said: string[] = [];
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) said.push(node.textContent ?? "");
    }).observe(status, { childList: true, subtree: true, characterData: true });
    await user.click(screen.getByRole("button", { name: "Make cover (photo 2)" }));
    // The photo that was the cover is photo 2 now: making it the cover again says the same words.
    await user.click(screen.getByRole("button", { name: "Make cover (photo 2)" }));
    expect(tokens()).toEqual([A, B, C]);
    expect(said).toEqual(["That photo is the cover now.", "That photo is the cover now."]);
  });

  it("marks a description the server found too long, described by the error, and it stays with its photo (amendments 11.5 and 13.4)", async () => {
    const user = userEvent.setup();
    const message = "Keep each photo's description to 125 characters.";
    show([saved[0], { ...saved[1], invalid: true }, saved[2]], message);
    const hint = "Optional: describe each photo for people who can't see it.";
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).toHaveAccessibleDescription(`${hint} Error: ${message}`);
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).toHaveAccessibleDescription(hint);
    await user.click(screen.getByRole("button", { name: "Make cover (photo 2)" }));
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).toHaveAccessibleDescription(`${hint} Error: ${message}`);
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).toHaveAccessibleDescription(hint);
  });

  it("keeps focus on the moved photo's own button, not a description whose words end like one (amendment 13.5)", async () => {
    const user = userEvent.setup();
    show([{ ...saved[0], alt: "Box, then:later" }, saved[1], saved[2]]);
    await user.click(screen.getByRole("button", { name: "Move later (photo 1)" }));
    expect(tokens()).toEqual([B, A, C]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move later (photo 2)" }));
  });

  it("adds picked photos as new ones, numbered by their place in the file input, says what it left out, then shrinks them", async () => {
    show(saved.slice(0, 1));
    const picked = [
      new File(["a"], "desk.png", { type: "image/png" }),
      new File(["b"], "cat.gif", { type: "image/gif" }),
      new File(["c"], "side.jpg", { type: "image/jpeg" }),
    ];
    const input = pick(picked);
    // The previews and the file input don't wait for the shrinking code: until it's done, the originals are there.
    expect(screen.getByText("Photo 3")).toBeInTheDocument();
    expect(tokens()).toEqual([A, "new:0", "new:1"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 photos added. 1 couldn't be added. Use JPG, PNG, WebP or HEIC photos. Getting your photos ready…",
    );
    expect(input.files).toEqual([picked[0], picked[2]]);
    await waitFor(() => expect(names(input)).toEqual(["desk.webp", "side.webp"]));
    expect(tokens()).toEqual([A, "new:0", "new:1"]);
    expect(screen.getByRole("status")).toHaveTextContent("Your photos are ready.");
  });

  it("takes iPhone photos (HEIC), keeping one the browser re-encodes and dropping one it can't open, saying so", async () => {
    // The stand-in can't open "stuck.HEIC" (as most browsers but Safari), so gives it back as it was.
    vi.doMock(SHRINK, () => ({
      shrink: async (file: File) => (file.name.startsWith("stuck") ? file : shrunkCopy(file)),
    }));
    show([]);
    const input = pick([
      new File(["a"], "opens.heic", { type: "image/heic" }),
      new File(["b"], "stuck.HEIC", { type: "" }),
      new File(["c"], "desk.png", { type: "image/png" }),
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("3 photos added. Getting your photos ready…");
    await waitFor(() => expect(names(input)).toEqual(["opens.webp", "desk.webp"]));
    expect(tokens()).toEqual(["new:0", "new:1"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "This browser can't open HEIC photos, so 1 wasn't added. Try Safari, or save it as JPG first. Your photos are ready.",
    );
  });

  it("asks for HEIC in the listing photo field only, since only it re-encodes photos", () => {
    const html = renderToStaticMarkup(<PhotoFieldset prefix="new" photos={[]} error={undefined} altError={undefined} />);
    expect(html).toContain('accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"');
  });

  it("shrinks each photo to its share of a post's 4 MiB, at lower qualities when it must (C2/C3 plan decision 16)", async () => {
    const asked: unknown[] = [];
    vi.doMock(SHRINK, () => ({
      shrink: async (file: File, to: unknown) => {
        asked.push(to);
        return shrunkCopy(file);
      },
    }));
    show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your photo is ready."));
    expect(asked).toEqual([{ side: 1600, quality: 0.8, budget: Math.floor((4 * 1024 * 1024) / 6), qualities: [0.8, 0.7, 0.6] }]);
  });

  it("asks for a few photos at a time without JavaScript, when the browser can't shrink them (C2/C3 plan Task 10)", () => {
    const html = renderToStaticMarkup(<PhotoFieldset prefix="new" photos={[]} error={undefined} altError={undefined} />);
    expect(html).toContain(
      "<noscript><p class=\"form-hint\">Add a few photos at a time: the photos you add in one go can come to 4 MB in all.</p></noscript>",
    );
  });

  it("keeps a picked file with no type or an unusual one, for the server's signature check (amendment 11.7)", async () => {
    show([]);
    const picked = [
      new File(["a"], "camera-upload", { type: "" }),
      new File(["b"], "old.jpg", { type: "image/jpg" }),
      new File(["c"], "cat.gif", { type: "image/gif" }),
    ];
    const input = pick(picked);
    expect(tokens()).toEqual(["new:0", "new:1"]);
    expect(input.files).toEqual(picked.slice(0, 2));
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 photos added. 1 couldn't be added. Use JPG, PNG, WebP or HEIC photos. Getting your photos ready…",
    );
    // Let the shrinking finish here, so the next test's first pick loads its own stand-in.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your photos are ready."));
  });

  it("shrinks one photo at a time, and shows each one's shrunk copy as soon as it's ready (amendment 11.2)", async () => {
    const { started, finish } = slowShrink();
    show([]);
    const input = pick([new File(["a"], "desk.png", { type: "image/png" }), new File(["b"], "side.jpg", { type: "image/jpeg" })]);
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    // Another pick waits its turn too.
    pick([new File(["c"], "back.jpg", { type: "image/jpeg" })]);
    finish(0);
    await waitFor(() => expect(started).toEqual(["desk.png", "side.jpg"]));
    expect(previews()).toEqual(["blob:desk.webp", "blob:side.jpg", "blob:back.jpg"]);
    expect(names(input)).toEqual(["desk.webp", "side.jpg", "back.jpg"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 photo added. Getting your photo ready…");
    finish(1);
    await waitFor(() => expect(started).toEqual(["desk.png", "side.jpg", "back.jpg"]));
    // Only when the last is done are they all ready.
    expect(screen.getByRole("status")).toHaveTextContent("Getting your photo ready…");
    finish(2);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your photo is ready."));
    expect(names(input)).toEqual(["desk.webp", "side.webp", "back.webp"]);
  });

  it("frees each preview's object URL once its picture has loaded, the shrunk copy's too (amendment 11.2)", async () => {
    const { made, freed } = objectUrls();
    show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    const img = document.querySelector("img")!;
    fireEvent.load(img);
    expect(freed).toEqual(["blob:desk.png"]);
    await waitFor(() => expect(img).toHaveAttribute("src", "blob:desk.webp"));
    fireEvent.load(img);
    expect(freed).toContain("blob:desk.webp");
    expect(made).toEqual(["blob:desk.png", "blob:desk.webp"]);
    expect(new Set(freed)).toEqual(new Set(made));
  });

  it("frees the original's object URL when its shrunk copy takes its place before it has loaded (amendment 13.2)", async () => {
    const { freed } = objectUrls();
    const { started, finish } = slowShrink();
    show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    const img = document.querySelector("img")!;
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    expect(freed).toEqual([]);
    finish(0);
    await waitFor(() => expect(img).toHaveAttribute("src", "blob:desk.webp"));
    expect(freed).toEqual(["blob:desk.png"]);
  });

  it("keeps the preview it has when the shrink gives the original back (amendment 13.2)", async () => {
    const { made, freed } = objectUrls();
    vi.doMock(SHRINK, () => ({ shrink: async (file: File) => file }));
    show([]);
    const picked = [new File(["a"], "desk.png", { type: "image/png" })];
    const input = pick(picked);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your photo is ready."));
    expect(made).toEqual(["blob:desk.png"]);
    expect(freed).toEqual([]);
    expect(previews()).toEqual(["blob:desk.png"]);
    expect(input.files).toEqual(picked);
  });

  it("frees a preview's object URL when its picture can't be shown, such as a file the browser can't decode (amendment 13.8)", async () => {
    const { freed } = objectUrls();
    show([]);
    pick([new File(["not a photo"], "desk.png", { type: "image/png" })]);
    fireEvent.error(document.querySelector("img")!);
    expect(freed).toEqual(["blob:desk.png"]);
    // Let the shrinking finish here, so the next test's first pick loads its own stand-in.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your photo is ready."));
  });

  it("holds a save while photos are being shrunk, then posts the shrunk files with the same button, once (amendment 11.1)", async () => {
    const user = userEvent.setup();
    const { started, finish } = slowShrink();
    const posted = show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    // Pressed again while it waits: still one save.
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    expect(posted).toEqual([]);
    finish(0);
    await waitFor(() => expect(posted).toEqual([{ files: ["desk.webp"], intent: "publish" }]));
    // Nothing is held once the photos are ready.
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(posted).toHaveLength(2);
  });

  it("posts a held save once, though a photo was picked and Save pressed again while it waited (amendment 13.1)", async () => {
    const user = userEvent.setup();
    const { started, log, finish } = slowShrink();
    const posted = show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    // The shrinking code has loaded before the next pick: two loads at once can miss this test's stand-in for it.
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    pick([new File(["b"], "side.jpg", { type: "image/jpeg" })]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    finish(0);
    await waitFor(() => expect(started).toEqual(["desk.png", "side.jpg"]));
    finish(1);
    await waitFor(() => expect(posted).not.toEqual([]));
    await settle();
    // One post, with both photos shrunk.
    expect(posted).toEqual([{ files: ["desk.webp", "side.webp"], intent: "publish" }]);
    // The second photo's shrink waited for the first's.
    expect(log).toEqual(["start desk.png", "done desk.png", "start side.jpg", "done side.jpg"]);
  });

  it("sends a held save with the button pressed last, so Save as draft pressed while it waits saves a draft (amendment 13.1)", async () => {
    const user = userEvent.setup();
    const { started, finish } = slowShrink();
    const posted = show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    finish(0);
    await waitFor(() => expect(posted).not.toEqual([]));
    await settle();
    expect(posted).toEqual([{ files: ["desk.webp"], intent: "draft" }]);
  });

  it("says a held save will go once the photos are ready, and doesn't then say they're ready (amendment 13.3)", async () => {
    const user = userEvent.setup();
    const { started, finish } = slowShrink();
    const posted = show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saving once your photos are ready…");
    finish(0);
    await waitFor(() => expect(posted).toHaveLength(1));
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Saving once your photos are ready…");
  });

  it("says a held save will go again when Save is pressed once more after a photo was picked while it waited (amendment 14.3)", async () => {
    const user = userEvent.setup();
    const { started, finish } = slowShrink();
    const posted = show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saving once your photos are ready…");
    // The new pick's words replace the save's: it's said what was added and that the photos are being readied.
    pick([new File(["b"], "side.jpg", { type: "image/jpeg" })]);
    expect(screen.getByRole("status")).toHaveTextContent("1 photo added. Getting your photo ready…");
    // Pressing Save again says the save is waiting, though the save itself was already held.
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saving once your photos are ready…");
    // And each press says it afresh: the line is emptied, then filled, so a screen reader announces it again
    // (amendment 11.8). A MutationObserver sees both changes, as a browser's accessibility tree would.
    const changes: string[] = [];
    const status = screen.getByRole("status");
    const watch = new MutationObserver((records) => {
      for (const record of records) {
        if (record.removedNodes.length > 0) changes.push("cleared");
        if (record.addedNodes.length > 0) changes.push(`set: ${status.textContent}`);
      }
    });
    watch.observe(status, { childList: true, characterData: true, subtree: true });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(changes).not.toEqual([]));
    watch.disconnect();
    expect(changes).toEqual(["cleared", "set: Saving once your photos are ready…"]);
    // Still one save.
    finish(0);
    await waitFor(() => expect(started).toEqual(["desk.png", "side.jpg"]));
    finish(1);
    await waitFor(() => expect(posted).not.toEqual([]));
    await settle();
    expect(posted).toEqual([{ files: ["desk.webp", "side.webp"], intent: "publish" }]);
  });

  it("lets a held save go after 15 seconds with the originals, which the server strips (amendment 11.1)", async () => {
    // A shrink that never finishes. It starts with the real clock, so the shrinking code has loaded before the test ends.
    const { started } = slowShrink();
    const posted = show([]);
    pick([new File(["a"], "desk.png", { type: "image/png" })]);
    await waitFor(() => expect(started).toEqual(["desk.png"]));
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(posted).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(posted).toEqual([{ files: ["desk.png"], intent: "publish" }]);
  });

  it("takes no more than 6 photos, and says how many it left out", async () => {
    const five = ["a", "b", "c", "d", "e"].map((name) => ({ src: `/photos/ph-${name}`, alt: "", thumb: `/t/${name}` }));
    show(five);
    const input = pick(["one", "two", "three"].map((name) => new File([name], `${name}.jpg`, { type: "image/jpeg" })));
    expect(tokens()).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent("1 photo added. Only 6 photos fit, so 2 were left out.");
    expect(names(input)).toEqual(["one.jpg"]);
    await waitFor(() => expect(names(input)).toEqual(["one.webp"]));
  });

  it("keeps the photos and the file input in step while the shrinking code is slow to load", async () => {
    const user = userEvent.setup();
    let arrive = () => {};
    const loaded = new Promise<void>((resolve) => (arrive = resolve));
    vi.doMock(SHRINK, async () => {
      await loaded;
      return { shrink: async (file: File) => shrunkCopy(file) };
    });
    show(saved.slice(0, 1));
    const input = pick([new File(["a"], "desk.png", { type: "image/png" }), new File(["b"], "side.jpg", { type: "image/jpeg" })]);
    await user.click(screen.getByRole("button", { name: "Make cover (photo 3)" }));
    // The n-th new photo is the n-th file in the input, in the photos' order, whatever has moved.
    expect(tokens()).toEqual(["new:0", A, "new:1"]);
    expect(names(input)).toEqual(["side.jpg", "desk.png"]);
    await user.click(screen.getByRole("button", { name: "Remove (photo 3)" }));
    expect(names(input)).toEqual(["side.jpg"]);
    arrive();
    await waitFor(() => expect(names(input)).toEqual(["side.webp"]));
    expect(tokens()).toEqual(["new:0", A]);
  });

  it("sends the originals when the shrinking code can't load, for the server to check and strip", async () => {
    vi.doMock(SHRINK, () => {
      throw new Error("The chunk didn't load");
    });
    show([]);
    const picked = [new File(["a"], "desk.png", { type: "image/png" })];
    const input = pick(picked);
    expect(screen.getByText("Photo 1 (the cover)")).toBeInTheDocument();
    // The originals are what will go, so they're ready: a save isn't held for them.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your photo is ready."));
    expect(input.files).toEqual(picked);
    expect(tokens()).toEqual(["new:0"]);
  });
});
