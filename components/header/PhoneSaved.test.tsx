import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhoneSaved } from "./PhoneSaved";

type Viewer = { id: string; roles: string[]; seller: { status: string; sellerSlug: string | null } | null };
const viewer = vi.hoisted(() => ({ account: null as Viewer | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

async function renderPhoneSaved() {
  const { container } = render((await PhoneSaved()) ?? <></>);
  return container;
}

describe("PhoneSaved", () => {
  it("renders nothing for a signed-out visitor", async () => {
    viewer.account = null;
    expect((await renderPhoneSaved()).innerHTML).toBe("");
  });

  it("renders nothing for a student, whose bar has Saved", async () => {
    viewer.account = { id: "a", roles: [], seller: null };
    expect((await renderPhoneSaved()).innerHTML).toBe("");
  });

  it("shows the heart, on phones only, for a seller", async () => {
    viewer.account = { id: "a", roles: [], seller: { status: "approved", sellerSlug: "x" } };
    await renderPhoneSaved();
    const link = screen.getByRole("link", { name: /^Saved/ });
    expect(link).toHaveAttribute("href", "/saved");
    expect(link).toHaveClass("wide:hidden");
  });

  it("shows the heart for an admin", async () => {
    viewer.account = { id: "a", roles: ["admin"], seller: null };
    await renderPhoneSaved();
    expect(screen.getByRole("link", { name: /^Saved/ })).toHaveAttribute("href", "/saved");
  });
});
