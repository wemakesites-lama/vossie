import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewsletterForm } from "./NewsletterForm";

describe("NewsletterForm", () => {
  it("explains what it is for and links the privacy notice", () => {
    render(<NewsletterForm />);
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveAttribute("type", "email");
    expect(screen.getByRole("link", { name: "privacy notice" })).toHaveAttribute("href", "/privacy");
  });

  it("can't send the address anywhere, even before the page is interactive", () => {
    render(<NewsletterForm />);
    const email = screen.getByRole("textbox", { name: "Email address" });
    expect(email).not.toHaveAttribute("name");
    expect(email.closest("form")).toHaveAttribute("method", "dialog");
  });

  it("does not accept an invalid address", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Get updates" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("confirms on screen and stores nothing", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<NewsletterForm />);
    const email = screen.getByRole("textbox", { name: "Email address" });
    await user.type(email, "thandi@example.com");
    await user.click(screen.getByRole("button", { name: "Get updates" }));
    expect(screen.getByRole("status")).toHaveTextContent("nothing was sent or saved");
    expect(email).toHaveValue("");
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("clears the confirmation when typing starts again, so a second sign-up is announced too", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    const email = screen.getByRole("textbox", { name: "Email address" });
    await user.type(email, "thandi@example.com");
    await user.click(screen.getByRole("button", { name: "Get updates" }));
    expect(screen.getByRole("status")).toHaveTextContent("nothing was sent or saved");
    await user.type(email, "s");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
