"use client";

import { useStore } from "@/game/store";
import { getPalette, type Palette } from "@/game/palette";

/** The active colour palette (light default, dark opt-in), reactive to toggles. */
export function usePalette(): Palette {
  const mode = useStore((s) => s.config.themeMode);
  return getPalette(mode);
}
