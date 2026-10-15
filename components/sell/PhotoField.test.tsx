import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.unstubAllGlobals();
  vi.doUnmock(SHRINK);
});

const tokens = () => [...document.querySelectorAll<HTMLInputElement>('input[name="photo"]')].map((input) => input.value);
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);

function show(photos = saved) {
  const submitted = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted();
      }}
    >
      <PhotoFieldset prefix="edit-l-001" photos={photos} error={undefined} />
    </form>,
  );
  // jsdom's file input takes only a real FileList, which only a real DataTransfer makes.
  const input = screen.getByLabelText<HTMLInputElement>("Add photos");
  Object.defineProperty(input, "files", { configurable: true, writable: true, value: [] });
  return submitted;
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
    expect(screen.getByLabelText("Add photos")).toHaveAccessibleDescription(/^Up to 6 JPG, PNG or WebP photos, 5 MB each\./);
  });

  it("moves a photo in place, says so, and keeps focus on it, without posting the form", async () => {
    const user = userEvent.setup();
    const submitted = show();
    await user.click(screen.getByRole("button", { name: "Make cover (photo 3)" }));
    expect(tokens()).toEqual([C, A, B]);
    expect(screen.getByRole("status")).toHaveTextContent("That photo is the cover now.");
    expect(document.activeElement?.closest("li")).toBe(screen.getByText("Photo 1 (the cover)").closest("li"));
    await user.click(screen.getByRole("button", { name: "Move later (photo 2)" }));
    expect(tokens()).toEqual([C, B, A]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved to photo 3 of 3.");
    expect(submitted).not.toHaveBeenCalled();
  });

  it("removes a photo", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Remove (photo 2)" }));
    expect(tokens()).toEqual([A, C]);
    expect(screen.getByRole("status")).toHaveTextContent("Photo removed. 2 left.");
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
    expect(screen.getByRole("status")).toHaveTextContent("2 photos added. 1 wasn't a JPG, PNG or WebP.");
    expect(input.files).toEqual([picked[0], picked[2]]);
    await waitFor(() => expect(names(input)).toEqual(["desk.webp", "side.webp"]));
    expect(tokens()).toEqual([A, "new:0", "new:1"]);
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
    // Give the failed import time to settle: nothing changes.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(input.files).toEqual(picked);
    expect(tokens()).toEqual(["new:0"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 photo added.");
  });
});
