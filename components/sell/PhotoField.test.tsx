import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoField } from "./PhotoField";

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

beforeEach(() => {
  vi.stubGlobal("DataTransfer", FakeDataTransfer);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: (file: File) => `blob:${file.name}` });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const tokens = () => [...document.querySelectorAll<HTMLInputElement>('input[name="photo"]')].map((input) => input.value);

function show(photos = saved) {
  const submitted = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted();
      }}
    >
      <PhotoField prefix="edit-l-001" photos={photos} error={undefined} />
    </form>,
  );
  return submitted;
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

  it("adds picked photos as new ones, numbered by their place in the file input, and says what it left out", async () => {
    show(saved.slice(0, 1));
    const input = screen.getByLabelText<HTMLInputElement>("Add photos");
    const picked = [
      new File(["a"], "desk.png", { type: "image/png" }),
      new File(["b"], "cat.gif", { type: "image/gif" }),
      new File(["c"], "side.jpg", { type: "image/jpeg" }),
    ];
    Object.defineProperty(input, "files", { configurable: true, writable: true, value: picked });
    fireEvent.change(input);
    expect(await screen.findByText("Photo 3")).toBeInTheDocument();
    expect(tokens()).toEqual([A, "new:0", "new:1"]);
    expect(screen.getByRole("status")).toHaveTextContent("2 photos added. 1 wasn't a JPG, PNG or WebP.");
    // jsdom can't decode them, so they go as they are, for the server to check and strip (plan decision 10).
    expect(input.files).toEqual([picked[0], picked[2]]);
  });
});
