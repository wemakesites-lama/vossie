import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarList } from "./BarList";

const rows = [
  { label: "Midrand", value: 28 },
  { label: "Pretoria", value: 19 },
  { label: "Durban", value: "hidden" as const },
  { label: "Cape Town", value: "under5" as const },
];

describe("BarList", () => {
  it("never draws a masked value as a bar, and prints it as words", () => {
    const { container } = render(<BarList rows={rows} label="Listings" summary="s" />);
    const bars = container.querySelectorAll<HTMLElement>(".bar-fill");
    expect(bars).toHaveLength(2);
    expect(bars[0].style.getPropertyValue("--v")).toBe("1");
    expect(bars[1].style.getPropertyValue("--v")).toBe("0.679");
    expect(container.querySelectorAll(".bar-masked")).toHaveLength(2);
    const values = [...container.querySelectorAll(".bar-value")].map((el) => el.textContent);
    expect(values).toEqual(["28", "19", "Hidden", "Under 5"]);
  });
});
