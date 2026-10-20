import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { searchKey } from "@/lib/saved-searches/rules";
import type { BrowseQuery, MatchQuery } from "@/lib/types";
import { SaveSearchControl } from "./SaveSearchControl";
import { SaveSearchRow } from "./SaveSearchViews";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 6).
vi.mock("./ViewerSaveSearch", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerSaveSearch: () => use(never) };
});
vi.mock("@/lib/saved-searches/actions", () => ({ saveThisSearch: async () => {} }));

const QUERY: BrowseQuery = {
  q: "calculator",
  category: "tech",
  campus: "midrand",
  campusFromLink: true,
  price: "under-100",
  pay: null,
  deals: null,
  sort: "match",
  shown: 24,
};
const SEARCH: MatchQuery = {
  q: "calculator",
  category: "tech",
  campus: "midrand",
  price: "under-100",
  pay: null,
  deals: null,
};
const FROM = "/browse?q=calculator&cat=tech&campus=midrand&price=under-100";

describe("Save this search on browse (search alerts spec 2.5, 2.6 and section 4)", () => {
  it("is a link through sign-in, back to the same results, in the static shell", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<SaveSearchControl query={QUERY} />);
    // The container is detached, so toBeInTheDocument() would fail; look at its text instead.
    expect(within(container).getByText("Hear when something new matches.").textContent).toBe("Hear when something new matches.");
    const link = within(container).getByRole("link", { name: "Save this search" });
    expect(link).toHaveAttribute("href", `/login?next=${encodeURIComponent(FROM)}`);
    expect(link).toHaveClass("btn-outline");
    expect(container.querySelector(".save-search")).not.toBeNull();
  });

  it("keys the session's part by its search, so a move to another search starts a new form (amendment 6)", () => {
    const box = SaveSearchControl({ query: QUERY }) as ReactElement<{ children: ReactElement }>;
    expect(box.props.children.key).toBe(searchKey(SEARCH));
    const other = SaveSearchControl({ query: { ...QUERY, q: "laptop" } }) as ReactElement<{ children: ReactElement }>;
    expect(other.props.children.key).not.toBe(box.props.children.key);
  });

  it("is a button when signed in, posting the search's fields, where it came from and a one-time token", () => {
    render(<SaveSearchRow search={SEARCH} from={FROM} state="new" note={null} once="tok" />);
    expect(screen.getByText("Hear when something new matches.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save this search" })).toHaveAttribute("type", "submit");
    const hidden = [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(Object.fromEntries(hidden.map((input) => [input.name, input.value]))).toEqual({
      q: "calculator",
      cat: "tech",
      campus: "midrand",
      price: "under-100",
      pay: "",
      deals: "",
      from: FROM,
      once: "tok",
    });
  });

  it("says when it's saved, or when 20 are, with Manage saved searches instead of the button", () => {
    const { unmount } = render(<SaveSearchRow search={SEARCH} from={FROM} state="saved" note={null} once={null} />);
    expect(screen.getByText("You've saved this search.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage saved searches" })).toHaveAttribute("href", "/saved?tab=searches");
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    render(<SaveSearchRow search={SEARCH} from={FROM} state="limit" note={null} once={null} />);
    expect(screen.getByText("You're at the 20-search limit.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage saved searches" })).toBeInTheDocument();
  });

  it("says Search saved. as a status after a save, and a refusal as an alert (plan decision 7)", () => {
    const { unmount } = render(<SaveSearchRow search={SEARCH} from={FROM} state="saved" note="saved" once={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Search saved.");
    unmount();
    const again = render(<SaveSearchRow search={SEARCH} from={FROM} state="saved" note="already" once={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("You've saved this search already.");
    again.unmount();
    render(<SaveSearchRow search={SEARCH} from={FROM} state="limit" note="limit" once={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("You're at the 20-search limit.");
    expect(screen.getByRole("link", { name: "Manage saved searches" })).toBeInTheDocument();
  });
});
