import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NewsletterForm } from "./NewsletterForm";

describe("NewsletterForm", () => {
  it("explains what it is for and links the privacy notice", () => {
    render(<NewsletterForm />);
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveAttribute("type", "email");
    expect(screen.getByRole("link", { name: "privacy notice" })).toHaveAttribute("href", "/privacy");
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
    render(<NewsletterForm />);
    const email = screen.getByRole("textbox", { name: "Email address" });
    await user.type(email, "thandi@example.com");
    await user.click(screen.getByRole("button", { name: "Get updates" }));
    expect(screen.getByRole("status")).toHaveTextContent("nothing was sent or saved");
    expect(email).toHaveValue("");
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});
