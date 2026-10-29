import { useSyncExternalStore } from "react";
import { getTheme, subscribeTheme, type Theme } from "@/lib/theme";

const systemOnServer = (): Theme => "system";

/**
 * The chosen theme, for the menu's switch. It is "system" during server rendering; colours never wait for it,
 * since the boot script and CSS apply the theme before first paint.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, systemOnServer);
}
