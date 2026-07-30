// Difficulty presets and the default game config.
//
// Green  – 3 wide stations, clustered, stationary. Easy first success.
// Yellow – 4 narrower stations spread out, and the signal MOVES: it slides back
//          and forth around its home position, so you have to follow it.
// Red    – 5 narrower stations still, moving faster and wandering further, with
//          the directional hint held back until you are nearly on top of one.
//
// The movement is Hedy Lamarr's frequency-hopping idea made catchable — the
// signal slides rather than teleporting (it used to jump, which was replaced on
// 2026-07-23). Speeds and window widths are deliberately set so dwell time
// (width / moveSpeed) is SHORTER than lockMs: a still needle can never catch a
// moving signal. Re-check that ratio whenever you retune either number.
//
// Each field climbs this ladder INDEPENDENTLY (green → yellow → red): complete
// one level and that field advances to the next. Word-mode messages tie into
// Ada Lovelace Day: green spells ADA, yellow HEDY, red GRACE. Level colours
// come from the active palette (see levelColor()).

import type { DifficultyPreset, GameConfig } from "./types";
import { DEFAULT_THEME_ID } from "./themes";

export const PRESETS: Record<string, DifficultyPreset> = {
  // Stationary, 3 letters (Ada Lovelace). Easy first success.
  green: {
    id: "green",
    label: "Grøn",
    stationCount: 3,
    width: 90,
    widthJitter: 0.1,
    spread: 0.6,
    decoys: 0,
    warmRange: 200,
    lockMs: 650,
    move: false,
    moveSpeed: 0,
    moveRange: 0,
    hintFrom: 0.45, // arrow helps you find the (stationary) signal
    messageMode: "word",
    message: "ADA",
    pictureId: "radio",
  },
  // Moving, 4 letters (Hedy Lamarr), WITH the directional arrow. The window is
  // narrow and the signal fast enough that a still needle can't catch it — you
  // have to follow it (dwell 58/110 ≈ 0.53s < lockMs 0.65s).
  yellow: {
    id: "yellow",
    label: "Gul",
    stationCount: 4,
    width: 58,
    widthJitter: 0.16,
    spread: 0.85,
    decoys: 0,
    warmRange: 175,
    lockMs: 650,
    move: true,
    moveSpeed: 110,
    moveRange: 200,
    hintFrom: 0.45, // full directional hint
    messageMode: "word",
    message: "HEDY",
    pictureId: "satellite",
  },
  // Moving, 5 letters (Grace Hopper), only a faint hint when very close.
  // Faster, narrower, wanders further (dwell 50/135 ≈ 0.37s < lockMs 0.62s).
  red: {
    id: "red",
    label: "Rød",
    stationCount: 5,
    width: 50,
    widthJitter: 0.14,
    spread: 0.92,
    decoys: 0,
    warmRange: 155,
    lockMs: 620,
    move: true,
    moveSpeed: 135,
    moveRange: 260,
    hintFrom: 0.8, // only nudges direction when you're nearly on it
    messageMode: "word",
    message: "GRACE",
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
