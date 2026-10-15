import { Geist, Special_Gothic_Condensed_One } from "next/font/google";

// Interim font set from the approved mockups (spec section 4).
// Components never use these names directly: they use font-display / font-text / font-accent.

export const displayInterim = Special_Gothic_Condensed_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sgc",
  // next/font has no metrics for this font, so it can't make an adjusted fallback. These are matched ones, measured on
  // capitals; their @font-face rules are in globals.css (decision 71). Naming them here also stops the build looking
  // for metrics it doesn't have (its "Failed to find font override values" warning).
  fallback: ["Vossie Display Fallback", "Vossie Display Fallback Arial", "Vossie Display Fallback Roboto"],
});

export const textInterim = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

/** Class names that define the font variables. They go on <html>. */
export const fontVariables = `${displayInterim.variable} ${textInterim.variable}`;
