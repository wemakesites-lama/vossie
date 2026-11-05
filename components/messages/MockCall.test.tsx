import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockCallOn } from "@/lib/messaging/mock-call";
import { makeThread } from "@/tests/helpers/fakes";
import { initials, MockCallView } from "./MockCall";

describe("the mock call", () => {
  it("says it's a demo, names who and what, and ends back in the thread", () => {
    render(<MockCallView thread={makeThread()} />);
    expect(screen.getByText("Demo call: nobody is being called")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Calling Tech corner" })).toBeInTheDocument();
    expect(screen.getByText("About Test listing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "End call" })).toHaveAttribute("href", "/messages/conv-test");
    expect(screen.getByRole("link", { name: "Back to Tech corner" })).toHaveAttribute("href", "/messages/conv-test");
  });

  it("takes up to two initials", () => {
    expect(initials("Tech corner")).toBe("TC");
    expect(initials("Ayanda")).toBe("A");
    expect(initials("  The Book Nook Midrand ")).toBe("TB");
  });

  it("is on only in sample mode or with Supabase's demo sign-in", () => {
    expect(mockCallOn({})).toBe(true);
    expect(mockCallOn({ VOSSIE_SAMPLE_MODE: "0" })).toBe(false);
    expect(mockCallOn({ VOSSIE_BACKEND: "supabase" })).toBe(false);
    expect(mockCallOn({ VOSSIE_BACKEND: "supabase", VOSSIE_DEMO_SIGN_IN: "1" })).toBe(true);
  });
});
