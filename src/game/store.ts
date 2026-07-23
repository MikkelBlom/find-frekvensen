// Global app store (Zustand). Holds the single source of truth for:
//   - config          : live game configuration (fields, difficulty, theme…)
//   - devices          : Map of receiver inputs (sim AND serial write here)
//   - snapshots        : low-rate panel state pushed by the engine for React
//   - serial/sim/debug : connection, simulator and debug-panel slices
//
// The game engine (plain TS, not React) reads/writes this store imperatively
// via useStore.getState(); React chrome subscribes with selectors.

import { create } from "zustand";
import type {
  DeviceState,
  DifficultyPreset,
  GameConfig,
  PanelSnapshot,
  Serial,
} from "./types";
import { defaultConfig, FIELD_COUNT_MAX, FIELD_COUNT_MIN } from "./presets";
import type { ThemeMode } from "./palette";

const MAX_SERIAL_LINES = 200;

export interface SimDeviceMeta {
  serial: Serial;
  mode: "manual" | "sweep" | "solve" | "idle";
}

interface SerialSlice {
  supported: boolean;
  connected: boolean;
  portLabel: string | null;
  baud: number;
  linesPerSec: number;
  totalLines: number;
  parseErrors: number;
  lastError: string | null;
  lastLines: string[];
}

interface SimSlice {
  enabled: boolean;
  devices: SimDeviceMeta[];
}

interface DebugSlice {
  visible: boolean;
  activeField: number;
  showFps: boolean;
  showOverlays: boolean;
  fps: number;
  renderLatencyMs: number;
  /** Engine clock (performance.now) so the debug table can show fresh ages. */
  clockMs: number;
}

export interface StoreState {
  config: GameConfig;
  devices: Record<Serial, DeviceState>;
  snapshots: PanelSnapshot[];
  serial: SerialSlice;
  sim: SimSlice;
  debug: DebugSlice;

  // ---- config actions ----
  setFieldCount: (n: number) => void;
  /** Edit one rung of the difficulty ladder (0=green, 1=yellow, 2=red). */
  patchLevel: (levelIndex: number, patch: Partial<DifficultyPreset>) => void;
  setThemeId: (id: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  setSoundEnabled: (on: boolean) => void;
  toggleSound: () => void;
  /** Restore persisted settings, validated + merged over current defaults. */
  hydrateConfig: (saved: Partial<GameConfig>) => void;

  // ---- device inputs (used by sim + serial) ----
  upsertDevice: (serial: Serial, pos: number, flags: number) => void;
  removeDevice: (serial: Serial) => void;
  clearDevices: () => void;

  // ---- engine -> react ----
  setSnapshots: (snaps: PanelSnapshot[]) => void;

  // ---- serial ----
  setSerial: (patch: Partial<SerialSlice>) => void;
  pushSerialLine: (line: string) => void;
  bumpParseError: (line: string) => void;

  // ---- simulator ----
  setSimEnabled: (on: boolean) => void;
  setSimDevices: (devices: SimDeviceMeta[]) => void;

  // ---- debug ----
  setDebug: (patch: Partial<DebugSlice>) => void;
  toggleDebug: () => void;
  setActiveField: (index: number) => void;
}

function clampFieldCount(n: number): number {
  return Math.max(FIELD_COUNT_MIN, Math.min(FIELD_COUNT_MAX, Math.round(n)));
}

export const useStore = create<StoreState>((set) => ({
  config: defaultConfig(),
  devices: {},
  snapshots: [],
  serial: {
    // Determined client-side by SerialManager.init() to avoid SSR hydration
    // mismatch (navigator is unavailable during server render).
    supported: false,
    connected: false,
    portLabel: null,
    baud: 115200,
    linesPerSec: 0,
    totalLines: 0,
    parseErrors: 0,
    lastError: null,
    lastLines: [],
  },
  sim: { enabled: false, devices: [] },
  debug: {
    visible: false,
    activeField: 0,
    showFps: false,
    showOverlays: false,
    fps: 0,
    renderLatencyMs: 0,
    clockMs: 0,
  },

  setFieldCount: (n) =>
    set((s) => ({ config: { ...s.config, fieldCount: clampFieldCount(n) } })),

  patchLevel: (levelIndex, patch) =>
    set((s) => {
      const levels = s.config.levels.map((lvl, i) =>
        i === levelIndex ? { ...lvl, ...patch } : lvl,
      );
      return { config: { ...s.config, levels } };
    }),

  setThemeId: (id) => set((s) => ({ config: { ...s.config, themeId: id } })),

  setThemeMode: (mode) => set((s) => ({ config: { ...s.config, themeMode: mode } })),

  toggleThemeMode: () =>
    set((s) => ({
      config: { ...s.config, themeMode: s.config.themeMode === "dark" ? "light" : "dark" },
    })),

  hydrateConfig: (saved) =>
    set((s) => {
      const base = s.config;
      // Merge each saved level over the canonical default so newly-added preset
      // fields are always present and level id/label/order stay fixed.
      const levels = base.levels.map((def, i) => {
        const sv = saved.levels?.[i];
        return sv ? { ...def, ...sv, id: def.id, label: def.label } : def;
      });
      const themeMode =
        saved.themeMode === "dark" || saved.themeMode === "light" ? saved.themeMode : base.themeMode;
      return {
        config: {
          fieldCount: clampFieldCount(saved.fieldCount ?? base.fieldCount),
          themeId: typeof saved.themeId === "string" ? saved.themeId : base.themeId,
          themeMode,
          soundEnabled: typeof saved.soundEnabled === "boolean" ? saved.soundEnabled : base.soundEnabled,
          levels,
        },
      };
    }),

  setSoundEnabled: (on) =>
    set((s) => ({ config: { ...s.config, soundEnabled: on } })),

  toggleSound: () =>
    set((s) => ({
      config: { ...s.config, soundEnabled: !s.config.soundEnabled },
    })),

  upsertDevice: (serial, pos, flags) =>
    set((s) => {
      const now = performance.now();
      const prev = s.devices[serial];
      const next: DeviceState = {
        serial,
        pos,
        flags,
        lastSeenMs: now,
        packets: (prev?.packets ?? 0) + 1,
      };
      return { devices: { ...s.devices, [serial]: next } };
    }),

  removeDevice: (serial) =>
    set((s) => {
      if (!s.devices[serial]) return {};
      const next = { ...s.devices };
      delete next[serial];
      return { devices: next };
    }),

  clearDevices: () => set({ devices: {} }),

  setSnapshots: (snaps) => set({ snapshots: snaps }),

  setSerial: (patch) => set((s) => ({ serial: { ...s.serial, ...patch } })),

  pushSerialLine: (line) =>
    set((s) => {
      const lastLines = [...s.serial.lastLines, line];
      if (lastLines.length > MAX_SERIAL_LINES) lastLines.shift();
      return {
        serial: {
          ...s.serial,
          lastLines,
          totalLines: s.serial.totalLines + 1,
        },
      };
    }),

  bumpParseError: (line) =>
    set((s) => ({
      serial: {
        ...s.serial,
        parseErrors: s.serial.parseErrors + 1,
        lastError: line,
      },
    })),

  setSimEnabled: (on) => set((s) => ({ sim: { ...s.sim, enabled: on } })),

  setSimDevices: (devices) => set((s) => ({ sim: { ...s.sim, devices } })),

  setDebug: (patch) => set((s) => ({ debug: { ...s.debug, ...patch } })),

  toggleDebug: () =>
    set((s) => ({ debug: { ...s.debug, visible: !s.debug.visible } })),

  setActiveField: (index) =>
    set((s) => ({ debug: { ...s.debug, activeField: index } })),
}));

/** Non-React accessor for the engine. */
export const store = {
  get: useStore.getState,
  set: useStore.setState,
  subscribe: useStore.subscribe,
};
