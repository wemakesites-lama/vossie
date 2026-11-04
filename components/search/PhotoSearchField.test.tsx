import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoSearchField } from "./PhotoSearchField";

// jsdom has no DataTransfer; this stands in for the browser's.
class FakeDataTransfer {
  readonly list: File[] = [];
  readonly items = { add: (file: File) => this.list.push(file) };
  get files() {
    return this.list as unknown as FileList;
  }
}

const SHRINK = "@/lib/photos/shrink";
const TO = { side: 1600, quality: 0.8, budget: 4_194_304, qualities: [0.8, 0.7, 0.6] };
const shrunkCopy = (file: File) => new File(["small"], file.name.replace(/\.[^.]*$/, ".webp"), { type: "image/webp" });
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);

/** A stand-in for lib/photos/shrink.ts whose shrink waits to be let go. */
function slowShrink() {
  const calls: Array<{ name: string; to: unknown }> = [];
  let release = () => {};
  vi.doMock(SHRINK, () => ({
    shrink: (file: File, to: unknown) => {
      calls.push({ name: file.name, to });
      return new Promise<File>((resolve) => {
        release = () => resolve(shrunkCopy(file));
      });
    },
  }));
  return { calls, finish: () => release() };
}

/** The field in a form with a Search button. Returns the files each post went with. */
function show() {
  const posted: string[][] = [];
  render(
    <form
      onSubmit={(event) => {
        // A form action skips a submit that something before it held (prevented), as React's does.
        if (!event.nativeEvent.defaultPrevented) posted.push(names(screen.getByLabelText("Photo")));
        event.preventDefault();
      }}
    >
      <label htmlFor="photo-search-file">Photo</label>
      <PhotoSearchField
        input={{ id: "photo-search-file", name: "photo", accept: "image/jpeg,image/png", className: "form-input" }}
        shrinkTo={TO}
        busy="Getting your photo ready…"
      />
      <button type="submit">Search</button>
    </form>,
  );
  const input = screen.getByLabelText<HTMLInputElement>("Photo");
  Object.defineProperty(input, "files", { configurable: true, writable: true, value: [] });
  return posted;
}

function pick(file: File) {
  const input = screen.getByLabelText<HTMLInputElement>("Photo");
  Object.defineProperty(input, "files", { configurable: true, writable: true, value: [file] });
  fireEvent.change(input);
  return input;
}

beforeEach(() => vi.stubGlobal("DataTransfer", FakeDataTransfer));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock(SHRINK);
});

describe("Snap to search's photo field (AI features spec 5.1 and 5.5)", () => {
  it("renders the file input with the server's attributes", () => {
    show();
    const input = screen.getByLabelText("Photo");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("name", "photo");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png");
  });

  it("re-encodes a picked photo and puts the shrunk copy in the input, saying so while it works", async () => {
    const { calls, finish } = slowShrink();
    show();
    const input = pick(new File(["big"], "calculator.jpg", { type: "image/jpeg" }));
    expect(screen.getByRole("status")).toHaveTextContent("Getting your photo ready…");
    await waitFor(() => expect(calls).toEqual([{ name: "calculator.jpg", to: TO }]));
    finish();
    await waitFor(() => expect(names(input)).toEqual(["calculator.webp"]));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(""));
  });

  it("holds a Search pressed during the re-encode, then sends it once with the shrunk copy", async () => {
    const user = userEvent.setup();
    const { calls, finish } = slowShrink();
    const posted = show();
    pick(new File(["big"], "calculator.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(posted).toEqual([]);
    finish();
    await waitFor(() => expect(posted).toEqual([["calculator.webp"]]));
    await new Promise((go) => setTimeout(go, 20));
    expect(posted).toHaveLength(1);
    // Nothing is held once the photo is ready.
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(posted).toHaveLength(2);
  });

  it("sends the original when the code can't load (the server strips it)", async () => {
    vi.doMock(SHRINK, () => {
      throw new Error("offline");
    });
    const user = userEvent.setup();
    const posted = show();
    pick(new File(["big"], "calculator.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(posted).toEqual([["calculator.jpg"]]));
  });
});
