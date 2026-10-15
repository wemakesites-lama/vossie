import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportSentBack } from "./ReportSentBack";

describe("the thank-you's way back (messaging spec 3.4)", () => {
  it("goes back to what was reported, or home when the address names nothing", async () => {
    const { unmount } = render(await ReportSentBack({ params: { listing: "l-001" } }));
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    unmount();
    render(await ReportSentBack({ params: { listing: "../x" } }));
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("href", "/");
  });
});
