// ============================================================================
// TOKENS — theme-independent sizing & timing.
//
// Colours live in palette.ts (light + dark). This file holds only values that
// don't change between themes: layout fractions and animation timings. Sizes
// are fractions of a field's canvas dimensions where possible, so the UI scales
// cleanly from 1080p to 4K.
// ============================================================================

export const tokens = {
  size: {
    faceInset: 0.05, // faceplate inset from canvas edge (fraction of min dim)
    scaleBandTop: 0.16, // scale band start (fraction of glass height)
    scaleBandHeight: 0.5, // scale band height (fraction of glass height)
    needleWidthFrac: 0.012, // needle line width (fraction of glass width)
    meterHeightFrac: 0.12, // signal meter height (fraction of glass height)
    tickMajorEvery: 100, // dial units between major ticks
    tickMinorEvery: 25,
  },

  timing: {
    revealMs: 650, // letter/tile reveal animation
    completeHoldMs: 7000, // celebrate before advancing/reset
    lockFlashMs: 500,
    needleTauMs: 55, // needle smoothing time constant
    offlineMs: 2000, // device considered offline after this
    snapshotHz: 12, // store snapshot rate
  },
} as const;
