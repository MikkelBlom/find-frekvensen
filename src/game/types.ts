// Core domain types for "Find Frekvensen".
//
// Design note: ALL game content (station positions, secret message, how the
// signal moves) lives in the web app. The micro:bit firmware is intentionally
// "dumb" — it only reports its own needle position. That keeps difficulty
// tuning here, testable without any hardware.

export type Serial = string;

/** How a field's secret message is revealed as stations are found. */
export type MessageMode = "word" | "image";

/** Difficulty identifiers used by the built-in presets. */
export type DifficultyId = "green" | "yellow" | "red" | string;

/** Lifecycle state of a single on-screen field/panel. */
export type PanelPhase = "waiting" | "tuning" | "complete";

/**
 * One receiver micro:bit's reported state. Both the simulator and the Web
 * Serial reader populate a `Map<Serial, DeviceState>` — that map is the single
 * input interface the game engine consumes, so sim and hardware are identical
 * from the engine's point of view.
 */
export interface DeviceState {
  serial: Serial;
  /** Raw needle position reported by the device, 0–1000. */
  pos: number;
  /** Button bitmask: bit0 = A pressed since last, bit1 = B pressed since last. */
  flags: number;
  /** Timestamp (performance.now) of the last packet from this device. */
  lastSeenMs: number;
  /** Packets received from this device (for the debug device table). */
  packets: number;
}

/** A hidden radio station the child hunts for on the dial. */
export interface StationDef {
  id: string;
  /** Current position on the dial, 0–1000 (drifts on moving levels). */
  position: number;
  /** Home position it wanders around (moving levels) / restores on reset. */
  basePosition: number;
  /** Capture-window width in dial units; locks when |needle - position| <= width/2. */
  width: number;
  /** Revealed content: a single letter (word mode) or a tile index (image mode). */
  payload: string;
  found: boolean;
  /** performance.now timestamp when this station was locked (drives reveal animation). */
  foundAtMs: number | null;
  /** Where a moving station is currently drifting toward (null = not moving). */
  moveTarget: number | null;
}

/** A decoy raises the felt signal strength but can never be locked. */
export interface DecoyDef {
  id: string;
  position: number;
}

/**
 * A live, editable difficulty definition. Switching difficulty loads a fresh
 * copy of one of the PRESETS; the debug panel may then mutate this working copy
 * (message, positions, movement) without touching the originals.
 */
export interface DifficultyPreset {
  id: DifficultyId;
  label: string;
  /** Number of stations to hunt. */
  stationCount: number;
  /** Nominal capture-window width in dial units (0–1000 scale). */
  width: number;
  /** 0–1 random variation applied per station width. */
  widthJitter: number;
  /** 0–1 fraction of the dial the stations are spread across (centred). */
  spread: number;
  /** Number of decoy "fake signal" peaks. */
  decoys: number;
  /** Distance (dial units) over which warmth ramps from 0 to 1 at a station. */
  warmRange: number;
  /** Continuous milliseconds inside the window required to lock. */
  lockMs: number;
  /**
   * Whether the signal SLIDES back and forth (Hedy Lamarr's frequency hopping,
   * reimagined as a moving target you have to follow rather than a teleport).
   */
  move: boolean;
  /** Drift speed in dial units per second (when move is true). */
  moveSpeed: number;
  /** How far a station wanders either side of its home position. */
  moveRange: number;
  /**
   * Warmth above which the directional arrow appears (0 = always when warm,
   * ≥1 = never). Higher = "less of a hint" (red only nudges when very close).
   */
  hintFrom: number;
  messageMode: MessageMode;
  /** Word to spell out (word mode); one letter per station. */
  message: string;
  /** Picture id from PICTURES (image mode). */
  pictureId: string;
}

/** Top-level, live-editable game configuration. */
export interface GameConfig {
  /** Number of on-screen fields, 1–10. */
  fieldCount: number;
  /**
   * The difficulty ladder (working copies of green/yellow/red). Each field
   * climbs this ladder independently: green → yellow → red. Editable live.
   */
  levels: DifficultyPreset[];
  /** Field identity theme id (numbers / animals / space …). */
  themeId: string;
  /** Sound is a pure "plus" — never required. Starts off. */
  soundEnabled: boolean;
  /** Light (default) or dark. */
  themeMode: "light" | "dark";
}

/** A revealed item shown in a field's message tray. */
export interface RevealItem {
  id: string;
  payload: string;
  position: number;
  foundAtMs: number | null;
}

/**
 * A low-frequency snapshot of a panel's game state, pushed from the engine to
 * the store so React chrome (titles, letters, banners) can render without
 * re-rendering at 60fps. The fast per-frame drawing happens on canvas.
 */
export interface PanelSnapshot {
  index: number;
  serial: Serial | null;
  phase: PanelPhase;
  /** Smoothed needle position, 0–1000. */
  needlePos: number;
  /** Real signal warmth toward the nearest unfound station, 0–1. */
  warmth: number;
  /** Felt signal for the bar/debug (only reaches full when capturable), 0–1. */
  displayWarmth: number;
  /** True only when the needle is inside a real station's capture window. */
  lockable: boolean;
  /** Which way the nearest station is when warm: -1 left, +1 right, 0 none. */
  directionHint: number;
  /** Lock progress toward the current station, 0–1. */
  lockProgress: number;
  lockingStationId: string | null;
  foundCount: number;
  totalStations: number;
  revealed: RevealItem[];
  messageMode: MessageMode;
  message: string;
  pictureId: string;
  completeAtMs: number | null;
  themeId: string;
  /** This field's current rung on the difficulty ladder (0=green…). */
  levelIndex: number;
  levelId: string;
  levelLabel: string;
  /** Milliseconds since this panel's device was last seen (for debug). */
  ageMs: number;
}

/** Field identity (icon + name) for one panel index. Accent comes from the palette. */
export interface FieldTheme {
  icon: string;
  name: string;
}
