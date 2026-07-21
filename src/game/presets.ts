// Difficulty presets and the default game config.
//
// Green  – few wide stations, clustered, no decoys. Easy first success.
// Yellow – more, narrower stations spread out, a couple of decoy peaks.
// Red    – narrow stations plus frequency HOPPING (Hedy Lamarr's idea): the
//          final signal keeps jumping, so you must re-catch it.
//
// Word-mode messages tie into Ada Lovelace Day: green spells ADA, yellow/red
// spell HEDY. Everything here is a plain data copy — switching difficulty loads
// a fresh clone so the debug panel can edit a working copy safely.

import { difficultyColors } from "./tokens";
import type { DifficultyPreset, GameConfig } from "./types";
import { DEFAULT_THEME_ID } from "./themes";

export const PRESETS: Record<string, DifficultyPreset> = {
  green: {
    id: "green",
    label: "Grøn",
    accent: difficultyColors.green,
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
    accent: difficultyColors.yellow,
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
    accent: difficultyColors.red,
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

export const DEFAULT_PRESET_ID = "green";

/** Deep-clone a preset so it can be edited as a live working copy. */
export function clonePreset(id: string): DifficultyPreset {
  const src = PRESETS[id] ?? PRESETS[DEFAULT_PRESET_ID];
  return { ...src };
}

export function defaultConfig(): GameConfig {
  return {
    fieldCount: 6,
    preset: clonePreset(DEFAULT_PRESET_ID),
    themeId: DEFAULT_THEME_ID,
    soundEnabled: false, // sound is a pure "plus" — starts off
  };
}

export const FIELD_COUNT_MIN = 1;
export const FIELD_COUNT_MAX = 10;
