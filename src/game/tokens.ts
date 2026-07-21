// ============================================================================
// DESIGN TOKENS — single source of truth for colours & sizing.
//
// Consumed by BOTH the canvas renderer (imported directly) and the DOM/React
// chrome (inline styles). Adjust values here to re-theme the whole app for a
// TV. Sizes are fractions of a field's canvas dimensions where possible, so the
// UI scales cleanly from 1080p to 4K.
// ============================================================================

export const tokens = {
  // ---- Global surface (the wall behind the fields) ----
  appBg: "#0a0e14",
  appBgGradientTop: "#121a26",
  appBgGradientBottom: "#070a10",
  headerText: "#f4ead2",
  headerMuted: "#8ea0b5",

  // ---- Radio faceplate (the retro dial) ----
  faceEdge: "#2a1c12", // outer bezel (dark walnut)
  faceTop: "#3a2a1c",
  faceBottom: "#1c130c",
  faceGlass: "#0e1512", // the "screen" behind the scale
  faceGlassTop: "#15251f",
  faceGlassBottom: "#0a110d",

  // ---- Scale, ticks, numbers ----
  scaleLine: "#c9b892",
  scaleTickMajor: "#e8d9b0",
  scaleTickMinor: "#8f8a72",
  scaleNumber: "#d8c79a",
  scaleGlow: "#f0c15a",

  // ---- Needle ----
  needle: "#ff5a3c",
  needleGlow: "#ff8a5a",
  needleKnob: "#ffd9c2",

  // ---- Signal warmth ramp (cold -> hot) ----
  warmCold: "#3b5a72",
  warmMid: "#4fae5a",
  warmHot: "#ffcf4d",
  warmLock: "#ff5a3c",

  // ---- Station markers (found) ----
  stationFound: "#ffd23f",
  stationFoundGlow: "#ffe58a",

  // ---- Noise / snow ----
  noiseTint: "#dfe7ef",

  // ---- Feedback / status ----
  good: "#4fd67a",
  warn: "#ffc244",
  bad: "#ff5d5d",
  info: "#5ac8fa",

  // ---- DOM chrome ----
  panelBorder: "#26313f",
  panelBorderActive: "#3c5570",
  trayEmpty: "#1a2430",
  trayEmptyBorder: "#2c3a4a",
  textOnGlass: "#f4ead2",
  textMuted: "#93a3b6",
  completeBg: "rgba(6, 20, 12, 0.82)",

  // ---- Field accent palette (per panel index) ----
  fieldAccents: [
    "#ff6b6b", // 1 coral
    "#4ecdc4", // 2 teal
    "#ffd166", // 3 amber
    "#a78bfa", // 4 violet
    "#6bcb77", // 5 green
    "#f78fb3", // 6 pink
    "#5ac8fa", // 7 sky
    "#f9a03f", // 8 orange
    "#8de969", // 9 lime
    "#c792ea", // 10 lilac
  ],

  // ---- Sizing scale ----
  size: {
    faceInset: 0.05, // faceplate inset from canvas edge (fraction of min dim)
    scaleBandTop: 0.16, // scale band start (fraction of glass height)
    scaleBandHeight: 0.5, // scale band height (fraction of glass height)
    needleWidthFrac: 0.012, // needle line width (fraction of glass width)
    meterHeightFrac: 0.12, // signal meter height (fraction of glass height)
    tickMajorEvery: 100, // dial units between major ticks
    tickMinorEvery: 25,
  },

  // ---- Timing (ms) ----
  timing: {
    revealMs: 650, // letter/tile reveal animation
    completeHoldMs: 7000, // celebrate before auto-reset
    lockFlashMs: 500,
    needleTauMs: 55, // needle smoothing time constant
    offlineMs: 2000, // device considered offline after this
    snapshotHz: 12, // store snapshot rate
  },
} as const;

/** Difficulty accent colours (also referenced by presets). */
export const difficultyColors = {
  green: "#4fd67a",
  yellow: "#ffc244",
  red: "#ff5d5d",
} as const;

/** Resolve a field accent colour for a given panel index. */
export function accentForIndex(index: number): string {
  const palette = tokens.fieldAccents;
  return palette[index % palette.length];
}
