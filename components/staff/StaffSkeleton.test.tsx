import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STAFF_SKELETON_HTML } from "@/tests/e2e/helpers/staff-skeleton";
import { StaffSkeleton } from "./StaffSkeleton";

describe("StaffSkeleton", () => {
  it("draws the trail, eyebrow, title and body, with no words", () => {
    const { container } = render(<StaffSkeleton />);
    for (const part of ["trail", "eyebrow", "title", "body"]) {
      expect(container.querySelector(`.staff-skeleton-${part}`)).not.toBeNull();
    }
    expect(container).toHaveTextContent("");
  });

  it("leaves out the body when short, for the confirm pages that are shorter than the full shell", () => {
    const { container } = render(<StaffSkeleton short />);
    for (const part of ["trail", "eyebrow", "title"]) {
      expect(container.querySelector(`.staff-skeleton-${part}`)).not.toBeNull();
    }
    expect(container.querySelector(".staff-skeleton-body")).toBeNull();
  });

  it("leaves out the trail for Today, which has none", () => {
    const { container } = render(<StaffSkeleton trail={false} />);
    expect(container.querySelector(".staff-skeleton-trail")).toBeNull();
  });

  it("matches the copy the end-to-end height checks inject (role views N3)", () => {
    expect(renderToStaticMarkup(<StaffSkeleton />)).toBe(STAFF_SKELETON_HTML);
  });
});
