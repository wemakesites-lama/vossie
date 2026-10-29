export const THEME_KEY = "vossie_theme";
export const THEME_ATTR = "data-theme";

/** "system" (Match my phone) is the default and stores nothing: CSS follows prefers-color-scheme (Dark and Night themes spec 3.1). */
export const THEMES = ["system", "light", "dark", "night"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Night's browser bar colour, Night's band. Light and Dark keep the layout's navy, so only Night adds a
 * <meta name="theme-color">, first in <head>: the browser uses the first one that matches (spec 3.4).
 */
export const NIGHT_BAR = "#0c1018";
export const NIGHT_BAR_ID = "night-bar";

export function isChosenTheme(value: unknown): value is Exclude<Theme, "system"> {
  return value === "light" || value === "dark" || value === "night";
}

const listeners = new Set<() => void>();

/** The <html> attribute is the source of truth; the boot script sets it before first paint. */
export function getTheme(): Theme {
  const value = document.documentElement.getAttribute(THEME_ATTR);
  return isChosenTheme(value) ? value : "system";
}

function showNightBar(on: boolean): void {
  const bar = document.getElementById(NIGHT_BAR_ID);
  if (!on) {
    bar?.remove();
    return;
  }
  if (bar) return;
  const meta = document.createElement("meta");
  meta.id = NIGHT_BAR_ID;
  meta.name = "theme-color";
  meta.content = NIGHT_BAR;
  document.head.prepend(meta);
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  if (isChosenTheme(theme)) root.setAttribute(THEME_ATTR, theme);
  else root.removeAttribute(THEME_ATTR);
  showNightBar(theme === "night");
  try {
    if (isChosenTheme(theme)) localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
