import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getRequest } from "@/lib/data";
import { RequestRow } from "./RequestRow";

async function show(id: string, campusName: string, categoryName: string) {
  return render(<RequestRow request={(await getRequest(id))!} campusName={campusName} categoryName={categoryName} />);
}

describe("RequestRow (community spec 4.1)", () => {
  it("links the title to the request's page", async () => {
    await show("r-001", "Midrand", "Tutoring");
    expect(screen.getByRole("heading", { level: 3, name: "Accounting 1 tutor this week" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounting 1 tutor this week" })).toHaveAttribute(
      "href",
      "/looking-for/r-001",
    );
  });

  it("says where, what and the budget, then when it was posted (in SAST) and the offers", async () => {
    const { container } = await show("r-001", "Midrand", "Tutoring");
    expect(screen.getByText("Midrand · Tutoring · Budget R300")).toBeInTheDocument();
    expect(screen.getByText(/^Posted/)).toHaveTextContent("Posted 13 Oct · 2 offers");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-13T07:30:00Z");
  });

  it("shows a swap, an open budget and no offers in plain words", async () => {
    const { unmount } = await show("r-007", "Eduvos Online", "Textbooks & notes");
    expect(screen.getByText("Eduvos Online · Textbooks & notes · Budget R150 or a swap")).toBeInTheDocument();
    unmount();
    await show("r-013", "Potchefstroom", "Tech");
    expect(screen.getByText("Potchefstroom · Tech · Open to offers or a swap")).toBeInTheDocument();
    expect(screen.getByText(/^Posted/)).toHaveTextContent("Posted 6 Oct · No offers yet");
  });
});
