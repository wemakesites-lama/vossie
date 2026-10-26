import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({ useLinkStatus: () => ({ pending: status.pending }) }));

const { NAV_PENDING_EVENT, NavPending } = await import("./NavPending");

const marked = () => document.documentElement.hasAttribute("data-nav-pending");

afterEach(() => {
  status.pending = false;
});

describe("NavPending (calm navigation spec 4, layer 4)", () => {
  it("marks <html> and asks the header back while its link waits, and unmarks it after", () => {
    const heard = vi.fn();
    window.addEventListener(NAV_PENDING_EVENT, heard);
    const { rerender, container } = render(<NavPending />);
    expect(container).toBeEmptyDOMElement();
    expect(marked()).toBe(false);

    status.pending = true;
    rerender(<NavPending />);
    expect(marked()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);

    status.pending = false;
    rerender(<NavPending />);
    expect(marked()).toBe(false);
    window.removeEventListener(NAV_PENDING_EVENT, heard);
  });

  it("stays marked until every pending link is done, and unmarks when one unmounts", () => {
    status.pending = true;
    const first = render(<NavPending />);
    const second = render(<NavPending />);
    first.unmount();
    expect(marked()).toBe(true);
    second.unmount();
    expect(marked()).toBe(false);
  });
});
