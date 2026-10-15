import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckList, RadioGroup, SelectField, TextField } from "./fields";

const choices = [
  { value: "cash", label: "Cash" },
  { value: "swap", label: "Swap" },
];

describe("the selling forms' parts (selling spec section 4)", () => {
  it("labels a text field, joins its hint and error to it, and marks it invalid", () => {
    render(<TextField id="t-title" name="title" label="Title" hint="Up to 70." defaultValue="Fan" error="Too long." />);
    const input = screen.getByRole("textbox", { name: "Title" });
    expect(input).toHaveValue("Fan");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Up to 70. Error: Too long.");
  });

  it("makes a long text field a textarea", () => {
    render(<TextField id="t-about" name="about" label="About" hint="Two lines." defaultValue={"a\nb"} multiline />);
    expect(screen.getByRole("textbox", { name: "About" }).tagName).toBe("TEXTAREA");
  });

  it("gives a select a first choice that asks", () => {
    render(<SelectField id="t-cat" name="category" label="Category" options={choices} placeholder="Choose" defaultValue="" />);
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Choose" })).toHaveValue("");
  });

  it("groups radios under a legend, with the first one's id the group's", () => {
    render(<RadioGroup id="t-pay" name="payMode" legend="How do you want to be paid?" options={choices} defaultValue="swap" />);
    expect(screen.getByRole("group", { name: "How do you want to be paid?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Cash" })).toHaveAttribute("id", "t-pay");
    expect(screen.getByRole("radio", { name: "Swap" })).toBeChecked();
  });

  it("groups boxes under a legend, ticking the chosen ones", () => {
    render(
      <CheckList id="t-spots" name="pickupPoint" legend="Pickup points" options={choices} chosen={["swap"]} hint="One or more." />,
    );
    expect(screen.getByRole("group", { name: "Pickup points" })).toHaveAccessibleDescription("One or more.");
    expect(screen.getByRole("checkbox", { name: "Cash" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Swap" })).toBeChecked();
  });
});
