import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampusNote } from "./CampusNote";

const viewer = vi.hoisted(() => ({ campus: "pretoria" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

afterEach(() => {
  viewer.campus = "pretoria";
});

const atMidrand = { campusSlug: "midrand", campusName: "Midrand" } as const;

describe("CampusNote (spec 5.3)", () => {
  it("says when a pickup isn't at the viewer's campus", async () => {
    render((await CampusNote({ ...atMidrand, handover: "pickup" }))!);
    expect(
      screen.getByText(
        "Midrand isn't your chosen campus (Pretoria), so you'd go there for this. Delivery between campuses isn't available yet.",
      ),
    ).toBeInTheDocument();
  });

  it("says so for services that happen on campus too", async () => {
    expect(await CampusNote({ ...atMidrand, handover: "on-campus" })).not.toBeNull();
  });

  it("stays quiet at the viewer's own campus, with no campus chosen, and for anything online", async () => {
    viewer.campus = "midrand";
    expect(await CampusNote({ ...atMidrand, handover: "pickup" })).toBeNull();
    viewer.campus = "all";
    expect(await CampusNote({ ...atMidrand, handover: "pickup" })).toBeNull();
    viewer.campus = "pretoria";
    expect(await CampusNote({ ...atMidrand, handover: "online" })).toBeNull();
    expect(await CampusNote({ ...atMidrand, handover: "on-campus-or-online" })).toBeNull();
  });
});
