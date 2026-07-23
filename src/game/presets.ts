// Difficulty presets and the default game config.
//
// Green  – few wide stations, clustered, no decoys. Easy first success.
// Yellow – more, narrower stations spread out, a couple of decoy peaks.
// Red    – narrow stations plus frequency HOPPING (Hedy Lamarr's idea): the
//          final signal keeps jumping, so you must re-catch it.
//
// Each field climbs this ladder INDEPENDENTLY (green → yellow → red): complete
// one level and that field advances to the next. Word-mode messages tie into
// Ada Lovelace Day: green spells ADA, yellow/red spell HEDY. Level colours come
// from the active palette (see levelColor()).

import type { DifficultyPreset, GameConfig } from "./types";
import { DEFAULT_THEME_ID } from "./themes";

export const PRESETS: Record<string, DifficultyPreset> = {
  green: {
    id: "green",
    label: "Grøn",
    stationCount: 3,
    width: 90,
    widthJitter: 0.1,
    spread: 0.55,
    decoys: 0,
    warmRange: 220,
    lockMs: 650,
    hop: false,
    hopIntervalMs: 4000,
    hopMode: "last",
    messageMode: "word",
    message: "ADA",
    pictureId: "radio",
  },
  yellow: {
    id: "yellow",
    label: "Gul",
    stationCount: 4,
    width: 55,
    widthJitter: 0.2,
    spread: 0.82,
    decoys: 2,
    warmRange: 150,
    lockMs: 700,
    hop: false,
    hopIntervalMs: 4000,
    hopMode: "last",
    messageMode: "word",
    message: "HEDY",
    pictureId: "satellite",
  },
  red: {
    id: "red",
    label: "Rød",
    stationCount: 4,
    width: 46,
    widthJitter: 0.25,
    spread: 0.9,
    decoys: 2,
    warmRange: 120,
    lockMs: 750,
    hop: true,
    hopIntervalMs: 3800,
    hopMode: "last",
    messageMode: "word",
    message: "HEDY",
    pictureId: "rocket",
  },
};

/** The fixed difficulty ladder order. */
export const LEVEL_ORDER = ["green", "yellow", "red"] as const;

/** Deep-clone a preset so it can be edited as a live working copy. */
export function clonePreset(id: string): DifficultyPreset {
  const src = PRESETS[id] ?? PRESETS.green;
  return { ...src };
}

/** Fresh editable working copies of the whole ladder. */
export function defaultLevels(): DifficultyPreset[] {
  return LEVEL_ORDER.map((id) => clonePreset(id));
}

export function defaultConfig(): GameConfig {
  return {
    fieldCount: 6,
    levels: defaultLevels(),
    themeId: DEFAULT_THEME_ID,
    soundEnabled: false, // sound is a pure "plus" — starts off
    themeMode: "light", // light by default
  };
}

export const FIELD_COUNT_MIN = 1;
export const FIELD_COUNT_MAX = 10;
