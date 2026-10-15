import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALT_MAX } from "@/lib/selling/rules";
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
  vi.restoreAllMocks();
});

/** Picks these files in the file input, as the browser does: they replace the input's files at once. */
function pickFiles(files: File[]) {
  const input = screen.getByLabelText<HTMLInputElement>("Add photos");
  Object.defineProperty(input, "files", { configurable: true, writable: true, value: files });
  fireEvent.change(input);
  return input;
}

/** The names of the files in the input (two files compare equal however different they are). */
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);

const png = (name: string, body = "a") => new File([body], name, { type: "image/png" });

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
    expect(names(input)).toEqual(["desk.png", "side.jpg"]);
  });

  it("never leaves an unready pick in the file input, and holds the list and further picks until the photos are ready", async () => {
    // The photo is still being decoded: a save now must post the files the tokens name, not the raw pick.
    let decoded: (bitmap: unknown) => void = () => {};
    vi.stubGlobal("createImageBitmap", () => new Promise((resolve) => (decoded = resolve)));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const user = userEvent.setup();
    show(saved.slice(0, 2));
    const input = pickFiles([png("desk.png")]);
    expect(names(input)).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Getting your photos ready…");
    await user.click(screen.getByRole("button", { name: "Remove (photo 1)" }));
    expect(tokens()).toEqual([A, B]);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Wait for your photos to be ready.");
    // The same words again still change the status line, so a screen reader says them again.
    const said = status.textContent;
    await user.click(screen.getByRole("button", { name: "Remove (photo 1)" }));
    expect(status).toHaveTextContent("Wait for your photos to be ready.");
    expect(status.textContent).not.toBe(said);
    pickFiles([png("cat.png")]);
    expect(names(input)).toEqual([]);
    expect(status).toHaveTextContent("Wait for your photos to be ready. Then add more.");
    // With no canvas to draw on, the photo goes as it is.
    await act(async () => decoded({ width: 10, height: 10, close: () => {} }));
    expect(tokens()).toEqual([A, B, "new:0"]);
    expect(names(input)).toEqual(["desk.png"]);
    expect(status).toHaveTextContent("1 photo added.");
  });

  it("shrinks a photo to 1,600px on a white background as JPEG where the browser can't make WebP", async () => {
    const bitmap = { width: 3200, height: 2000, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", async () => bitmap);
    const context = { drawImage: vi.fn(), fillRect: vi.fn() } as Record<string, unknown>;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    // Safari makes a PNG when asked for WebP.
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done, type) =>
      done(new Blob(["x"], { type: type === "image/webp" ? "image/png" : type })),
    );
    show(saved.slice(0, 1));
    const input = pickFiles([png("desk.photo.png")]);
    expect(await screen.findByText("Photo 2")).toBeInTheDocument();
    expect(input.files?.[0]).toMatchObject({ name: "desk.photo.jpg", type: "image/jpeg" });
    expect(context.imageSmoothingQuality).toBe("high");
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1000);
    expect(bitmap.close).toHaveBeenCalled();
    expect(context).toMatchObject({ fillStyle: "#fff", globalCompositeOperation: "destination-over" });
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1000);
  });

  it("leaves out empty files, so new photos' numbers match the files the server reads, and lets the server check a file of no known type", async () => {
    show(saved.slice(0, 1));
    const input = pickFiles([png("empty.png", ""), new File(["b"], "scan", { type: "" })]);
    expect(await screen.findByText("Photo 2")).toBeInTheDocument();
    expect(tokens()).toEqual([A, "new:0"]);
    expect(names(input)).toEqual(["scan"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 photo added. 1 wasn't a JPG, PNG or WebP.");
  });

  it("renumbers the new photos after one is removed, keeping each description with its photo, and leaves the rest in the file input", async () => {
    const user = userEvent.setup();
    show(saved.slice(0, 1));
    const input = pickFiles([png("first.png"), png("second.png")]);
    expect(await screen.findByText("Photo 3")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Describe photo 3" }), "The side");
    await user.click(screen.getByRole("button", { name: "Remove (photo 2)" }));
    expect(tokens()).toEqual([A, "new:0"]);
    expect(names(input)).toEqual(["second.png"]);
    const described = screen.getByRole("textbox", { name: "Describe photo 2" });
    expect(described).toHaveAttribute("name", "alt:new:0");
    expect(described).toHaveValue("The side");
    expect(screen.getByRole("status")).toHaveTextContent("Photo removed. 2 left.");
    expect(document.activeElement?.closest("li")).toBe(described.closest("li"));
  });

  it("keeps each new photo's token pointing at its own file when new photos move", async () => {
    const user = userEvent.setup();
    show(saved.slice(0, 1));
    const input = pickFiles([png("first.png"), png("second.png")]);
    expect(await screen.findByText("Photo 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make cover (photo 3)" }));
    expect(tokens()).toEqual(["new:1", A, "new:0"]);
    expect(names(input)).toEqual(["first.png", "second.png"]);
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).toHaveAttribute("name", "alt:new:1");
    expect([...document.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([
      "blob:second.png",
      "/_next/image?url=a",
      "blob:first.png",
    ]);
  });

  it("lets go of a new photo's object address once its small picture has loaded", async () => {
    const revoked = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revoked });
    show(saved.slice(0, 1));
    pickFiles([png("desk.png")]);
    expect(await screen.findByText("Photo 2")).toBeInTheDocument();
    const [savedThumb, newThumb] = document.querySelectorAll("img");
    fireEvent.load(savedThumb);
    expect(revoked).not.toHaveBeenCalled();
    fireEvent.load(newThumb);
    expect(revoked).toHaveBeenCalledWith("blob:desk.png");
  });

  it("gives the limit for a photo's description", () => {
    show();
    expect(screen.getByText(/Describe each photo for people who can't see it/)).toHaveTextContent(
      `Up to ${ALT_MAX} characters.`,
    );
  });
});
