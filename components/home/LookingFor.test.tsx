import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LookingFor } from "./LookingFor";

// The requests read the cookie on the server; LookingForRequests.test.tsx covers them.
vi.mock("./LookingForRequests", () => ({
  LookingForRequests: () => <ul aria-label="Open requests" />,
  RequestsSkeleton: () => null,
}));

describe("LookingFor (spec 7.11)", () => {
  it("asks for requests, with a navy eyebrow on the sky band", () => {
    render(<LookingFor />);
    expect(screen.getByRole("region", { name: "Can’t find it? Ask for it." })).toBeInTheDocument();
    expect(screen.getByText("Looking For")).toHaveClass("text-navy");
    expect(screen.getByRole("list", { name: "Open requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for");
  });
});
