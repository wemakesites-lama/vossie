import { Geist, Special_Gothic_Condensed_One } from "next/font/google";

// Interim font set from the approved mockups (spec section 4).
// Components never use these names directly: they use font-display / font-text / font-accent.

export const displayInterim = Special_Gothic_Condensed_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sgc",
});

export const textInterim = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

/** Class names that define the font variables. They go on <html>. */
export const fontVariables = `${displayInterim.variable} ${textInterim.variable}`;
