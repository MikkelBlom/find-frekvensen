// ============================================================================
// PALETTE — light + dark theme colours (single source of truth for colour).
//
// Light is the DEFAULT. The aesthetic is a warm vintage radio: cream illuminated
// dials, wood-tone cabinets, and a restrained, non-neon accent palette. Dark is
// an opt-in warm "espresso" variant of the same idea.
//
// Sizing and timing (theme-independent) live in tokens.ts. Both the canvas
// renderer and the DOM read colours from here via the active Palette.
// ============================================================================

export type ThemeMode = "light" | "dark";

export interface Palette {
  mode: ThemeMode;

  // Page shell
  pageBg: string;
  pageBgEdge: string;
  title: string;
  subtitle: string;

  // Field card + cabinet (the wooden radio frame)
  cardBg: string;
  cardBorder: string;
  cardBorderActive: string;
  faceEdge: string;
  faceTop: string;
  faceBottom: string;

  // Dial "glass" (the illuminated dial face)
  faceGlassTop: string;
  faceGlassBottom: string;

  // Scale + numerals
  scaleLine: string;
  scaleTickMajor: string;
  scaleTickMinor: string;
  scaleNumber: string;

  // Needle
  needle: string;
  needleKnob: string;

  // Warmth ramp (weak -> locked)
  warmCold: string;
  warmMid: string;
  warmHot: string;
  warmLock: string;

  // Found station marker + collected tokens
  found: string;
  foundGlow: string;
  foundText: string;

  // Static / grain
  noise: string;
  /** true => dark grain on a light dial; false => light grain on a dark dial. */
  noiseDark: boolean;

  // Meter + trays
  meterTrack: string;
  trayEmpty: string;
  trayEmptyBorder: string;

  // Text on the dial / muted
  textOnGlass: string;
  textMuted: string;

  // Status
  good: string;
  warn: string;
  bad: string;
  info: string;

  // Complete celebration
  completeScrim: string;
  completeWord: string;

  // Difficulty levels
  levelColors: { green: string; yellow: string; red: string };

  // Per-field accents
  fieldAccents: string[];
}

const LIGHT: Palette = {
  mode: "light",

  pageBg: "#efe7d6",
  pageBgEdge: "#e2d7bf",
  title: "#2c2016",
  subtitle: "#93815f",

  cardBg: "#f8f2e4",
  cardBorder: "#dbccab",
  cardBorderActive: "#b98a4e",
  faceEdge: "#7c5a30",
  faceTop: "#caa46e",
  faceBottom: "#a67c46",

  faceGlassTop: "#f7efd9",
  faceGlassBottom: "#ecdfbf",

  scaleLine: "#5f4a2c",
  scaleTickMajor: "#3f3320",
  scaleTickMinor: "#a08a63",
  scaleNumber: "#43351f",

  needle: "#c8412a",
  needleKnob: "#8f2d1c",

  warmCold: "#a9b1b3",
  warmMid: "#6f9c5b",
  warmHot: "#dca62c",
  warmLock: "#c8412a",

  found: "#b9812a",
  foundGlow: "#e0b458",
  foundText: "#2c2016",

  noise: "#3a2c1a",
  noiseDark: true,

  meterTrack: "#e0d3b6",
  trayEmpty: "#ece2ca",
  trayEmptyBorder: "#d3c3a0",

  textOnGlass: "#3a2c1a",
  textMuted: "#8a7856",

  good: "#3f8f57",
  warn: "#c1902e",
  bad: "#bf4a30",
  info: "#3f77a6",

  completeScrim: "rgba(247, 239, 217, 0.9)",
  completeWord: "#b5471f",

  levelColors: { green: "#4f9a5e", yellow: "#cc9a2c", red: "#c0492f" },

  fieldAccents: [
    "#c15b6b", // dusty rose
    "#3f8f88", // teal
    "#c2932e", // mustard
    "#5f7aa8", // slate blue
    "#7d9451", // olive
    "#8f5a86", // plum
    "#c2703e", // terracotta
    "#4f86a3", // denim
    "#6f9b6a", // sage
    "#9a6f9b", // mauve
  ],
};

const DARK: Palette = {
  mode: "dark",

  pageBg: "#181310",
  pageBgEdge: "#0f0b08",
  title: "#f2e8d4",
  subtitle: "#b09a78",

  cardBg: "#241d16",
  cardBorder: "#3a2f20",
  cardBorderActive: "#b98a4e",
  faceEdge: "#241a0e",
  faceTop: "#5a4226",
  faceBottom: "#3a2a17",

  faceGlassTop: "#26200f",
  faceGlassBottom: "#161206",

  scaleLine: "#c9b892",
  scaleTickMajor: "#ecdcae",
  scaleTickMinor: "#8f7d59",
  scaleNumber: "#e0cf9f",

  needle: "#ff5a3c",
  needleKnob: "#ffd9c2",

  warmCold: "#5c6b70",
  warmMid: "#5aa06a",
  warmHot: "#e6b64f",
  warmLock: "#ff6a44",

  found: "#e6b64f",
  foundGlow: "#ffe08a",
  foundText: "#241a0e",

  noise: "#e8dcc2",
  noiseDark: false,

  meterTrack: "#2b2418",
  trayEmpty: "#221b12",
  trayEmptyBorder: "#3a3020",

  textOnGlass: "#f2e8d4",
  textMuted: "#a08f70",

  good: "#5fc47c",
  warn: "#e6b64f",
  bad: "#ff6a55",
  info: "#5ab0e0",

  completeScrim: "rgba(18, 13, 8, 0.86)",
  completeWord: "#f0c05a",

  levelColors: { green: "#5fc47c", yellow: "#e6b64f", red: "#ff6a55" },

  fieldAccents: [
    "#e0808f", // rose
    "#4fbdb2", // teal
    "#e6bd4f", // mustard
    "#7f9bd4", // slate blue
    "#9fbf6c", // olive
    "#c08bb8", // plum
    "#e69463", // terracotta
    "#6fb4d4", // denim
    "#8fca86", // sage
    "#c093c0", // mauve
  ],
};

export function getPalette(mode: ThemeMode): Palette {
  return mode === "dark" ? DARK : LIGHT;
}

export function accentFor(palette: Palette, index: number): string {
  return palette.fieldAccents[index % palette.fieldAccents.length];
}

export function levelColor(palette: Palette, levelId: string): string {
  if (levelId === "yellow") return palette.levelColors.yellow;
  if (levelId === "red") return palette.levelColors.red;
  return palette.levelColors.green;
}
