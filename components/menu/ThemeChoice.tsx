"use client";

import { useTheme } from "@/hooks/useTheme";
import { setTheme, type Theme } from "@/lib/theme";

const OPTIONS: [Theme, string][] = [
  ["system", "Match my phone"],
  ["light", "Light"],
  ["dark", "Dark"],
  ["night", "Night"],
];

/**
 * The menu's Theme choice (Dark and Night themes spec 3.3): native radios, so arrow keys move between them, and the
 * chosen one is filled, not only coloured. It loads with MenuSettings when the menu first opens.
 */
export function ThemeChoice() {
  const theme = useTheme();
  return (
    <fieldset className="theme-choice">
      <legend className="theme-choice-legend">Theme</legend>
      <div className="theme-options">
        {OPTIONS.map(([value, label]) => (
          <label key={value} className="theme-option">
            <input
              type="radio"
              name="vossie-theme"
              value={value}
              checked={theme === value}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
