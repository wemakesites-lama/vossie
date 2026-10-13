import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectBox, collectCopy } from "./CollectBox";

describe("collectCopy (spec 5.3)", () => {
  it("words each way of handing over", () => {
    expect(collectCopy("pickup", "Midrand", "Library entrance")).toEqual({
      heading: "Collect at Midrand · Library entrance",
      line: "See it before you pay, and pay when you collect.",
    });
    expect(collectCopy("on-campus", "Midrand", null)).toEqual({
      heading: "On campus at Midrand",
      line: "Agree a time and place when you message.",
    });
    expect(collectCopy("on-campus-or-online", "Pretoria", null)).toEqual({
      heading: "On campus at Pretoria, or online",
      line: "Agree how when you message.",
    });
    expect(collectCopy("online", "Eduvos Online", null)).toEqual({
      heading: "Online",
      line: "Done online, from anywhere.",
    });
  });
});

describe("CollectBox", () => {
  it("shows the heading and line, with room for the campus note", () => {
    render(
      <CollectBox handover="pickup" campusName="Midrand" pickupPointName="Library entrance">
        <p>Note</p>
      </CollectBox>,
    );
    expect(screen.getByText("Collect at Midrand · Library entrance")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
  });
});
