// GameEngine — the beating heart. A single requestAnimationFrame loop that:
//   1. ticks the simulator (if enabled) so virtual devices update
//   2. reads device inputs + config from the store
//   3. assigns online devices to free fields, frees offline ones
//   4. advances each field's game logic (warmth, lock, reveal, complete, hop)
//   5. draws every attached canvas
//   6. pushes low-rate snapshots to the store for React chrome
//
// It is plain TS (not React) and talks to the store imperatively. Fast
// per-frame values (needle, warmth, noise) live here and are drawn straight to
// canvas; only stable, low-rate state is mirrored into the store.

import { createLayout, stepStationMovement, stationCountFor } from "./gameFactory";
import { store } from "./store";
import { tokens } from "./tokens";
import { getPalette, accentFor } from "./palette";
import type { Palette } from "./palette";
import type {
  DecoyDef,
  DeviceState,
  DifficultyPreset,
  GameConfig,
  PanelPhase,
  PanelSnapshot,
  RevealItem,
  Serial,
  StationDef,
} from "./types";
import { drawField, drawFaceplate, fieldGeometry } from "@/render/drawField";
import { Confetti } from "@/render/confetti";
import type { Simulator } from "@/sim/simulator";

export type EngineEvent = "lock" | "complete" | "warmthTick";
export type EngineEventHandler = (event: EngineEvent, panelIndex: number) => void;

interface PanelRuntime {
  index: number;
  serial: Serial | null;
  phase: PanelPhase;
  /** Rung on the difficulty ladder: 0=green, 1=yellow, 2=red. */
  levelIndex: number;

  stations: StationDef[];
  decoys: DecoyDef[];

  needlePos: number;
  warmth: number;
  displayWarmth: number;
  lockable: boolean;
  directionHint: number;
  lockProgress: number;
  lockingStationId: string | null;

  completeAtMs: number | null;

  confetti: Confetti;

  // view / canvas (persist across game resets)
  canvas: HTMLCanvasElement | null;
  cssW: number;
  cssH: number;
  dpr: number;
  bg: HTMLCanvasElement | null;
  bgKey: string;
}

const MAX_DT = 100; // ms — clamp huge gaps (e.g. background tab)

export class GameEngine {
  private panels: PanelRuntime[] = [];
  private raf = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private lastSnapshot = 0;
  private running = false;
  private frameTimes: number[] = [];
  private simulator: Simulator | null = null;
  private onEvent: EngineEventHandler | null = null;

  setSimulator(sim: Simulator): void {
    this.simulator = sim;
  }
  setEventHandler(handler: EngineEventHandler | null): void {
    this.onEvent = handler;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.rafLoop);
    // Fallback when the tab is hidden (rAF is paused by the browser): keeps the
    // game and rendering alive on a minimised kiosk or offscreen preview.
    this.interval = setInterval(this.intervalTick, 1000 / 30);
  }
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.interval != null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // -- Canvas registration (called by RadioField) --------------------------
  attachCanvas(index: number, canvas: HTMLCanvasElement | null): void {
    const p = this.ensurePanel(index);
    p.canvas = canvas;
    p.bg = null; // force faceplate rebuild
    p.bgKey = "";
  }
  updateMetrics(index: number, cssW: number, cssH: number, dpr: number): void {
    const p = this.ensurePanel(index);
    p.cssW = cssW;
    p.cssH = cssH;
    p.dpr = dpr;
  }

  /** The preset for a panel's current rung on the ladder. */
  private levelFor(p: PanelRuntime): DifficultyPreset {
    const levels = store.get().config.levels;
    return levels[Math.min(p.levelIndex, levels.length - 1)] ?? levels[0];
  }

  /** Reset a single field back to the first level (the UI reset button). */
  resetPanelToStart(index: number): void {
    const p = this.panels[index];
    if (!p) return;
    p.levelIndex = 0;
    this.startGame(p);
  }
  /** Reset every active field back to the first level. */
  resetAllToStart(): void {
    for (const p of this.panels) {
      if (!p.serial) continue;
      p.levelIndex = 0;
      this.startGame(p);
    }
  }
  /** Regenerate active fields at their current level (after a live edit). */
  regenerateAll(): void {
    for (const p of this.panels) if (p.serial) this.startGame(p);
  }
  /** Force every active field onto a specific level (debug/testing). */
  setAllToLevel(levelIndex: number): void {
    for (const p of this.panels) {
      if (!p.serial) continue;
      p.levelIndex = levelIndex;
      this.startGame(p);
    }
  }
  /**
   * Position the auto-solver should drive toward for a device's field: the
   * nearest unfound station, or null if the field is waiting/complete. Lets the
   * simulator actually complete fields for demos and screenshots.
   */
  solveTargetFor(serial: Serial): number | null {
    const p = this.panels.find((pp) => pp.serial === serial);
    if (!p || p.phase !== "tuning") return null;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const s of p.stations) {
      if (s.found) continue;
      const d = Math.abs(p.needlePos - s.position);
      if (d < bestDist) {
        bestDist = d;
        best = s.position;
      }
    }
    return best;
  }

  /** Debug "god mode": reveal all stations on a field. */
  revealAll(index: number): void {
    this.revealCount(index, Infinity);
  }

  /** Reveal the first `k` unfound stations on a field (deterministic demos). */
  revealCount(index: number, k: number): void {
    const p = this.panels[index];
    if (!p) return;
    const now = performance.now();
    let done = 0;
    for (const st of p.stations) {
      if (done >= k) break;
      if (!st.found) {
        st.found = true;
        st.foundAtMs = now;
        done++;
      }
    }
  }

  // -- Main loop -----------------------------------------------------------
  // rAF drives smooth 60fps rendering when the tab is visible.
  private rafLoop = (now: number): void => {
    if (!this.running) return;
    this.frame(now);
    this.raf = requestAnimationFrame(this.rafLoop);
  };
  // Timer fallback only steps when rAF is paused (tab hidden).
  private intervalTick = (): void => {
    if (!this.running) return;
    if (typeof document !== "undefined" && document.hidden) {
      this.frame(performance.now());
    }
  };

  private frame(now: number): void {
    const frameStart = now;
    let dt = now - this.lastFrame;
    this.lastFrame = now;
    if (dt > MAX_DT) dt = MAX_DT;

    const state = store.get();
    const config = state.config;

    // 1) simulator feeds the device map
    if (state.sim.enabled && this.simulator) this.simulator.tick(dt);

    // 2) sync panel count to config
    this.syncPanelCount(config.fieldCount);

    // 3) assignment
    this.updateAssignments(state.devices, now);

    // 4 + 5) logic + draw
    for (const p of this.panels) {
      this.updatePanel(p, config, state.devices[p.serial ?? ""], dt, now);
      this.drawPanel(p, config, now);
    }

    // 6) snapshots at snapshotHz
    if (now - this.lastSnapshot > 1000 / tokens.timing.snapshotHz) {
      this.lastSnapshot = now;
      this.pushSnapshots(config, now);
    }

    // fps + latency overlay
    this.trackFps(now, performance.now() - frameStart);
  }

  private ensurePanel(index: number): PanelRuntime {
    while (this.panels.length <= index) {
      this.panels.push(this.blankPanel(this.panels.length));
    }
    return this.panels[index];
  }

  private blankPanel(index: number): PanelRuntime {
    return {
      index,
      serial: null,
      phase: "waiting",
      levelIndex: 0,
      stations: [],
      decoys: [],
      needlePos: 500,
      warmth: 0,
      displayWarmth: 0,
      lockable: false,
      directionHint: 0,
      lockProgress: 0,
      lockingStationId: null,
      completeAtMs: null,
      confetti: new Confetti(),
      canvas: null,
      cssW: 0,
      cssH: 0,
      dpr: 1,
      bg: null,
      bgKey: "",
    };
  }

  private syncPanelCount(count: number): void {
    while (this.panels.length < count) this.panels.push(this.blankPanel(this.panels.length));
    if (this.panels.length > count) this.panels.length = count;
  }

  private updateAssignments(devices: Record<Serial, DeviceState>, now: number): void {
    // Free panels whose device vanished or went offline.
    for (const p of this.panels) {
      if (!p.serial) continue;
      const d = devices[p.serial];
      if (!d || now - d.lastSeenMs > tokens.timing.offlineMs) {
        p.serial = null;
        p.phase = "waiting";
        p.stations = [];
        p.decoys = [];
        p.lockProgress = 0;
        p.lockingStationId = null;
        p.completeAtMs = null;
      }
    }

    // Assign online, unassigned devices to the lowest free field.
    const assigned = new Set(this.panels.map((p) => p.serial).filter(Boolean) as Serial[]);
    for (const serial of Object.keys(devices)) {
      if (assigned.has(serial)) continue;
      const d = devices[serial];
      if (now - d.lastSeenMs > tokens.timing.offlineMs) continue;
      const free = this.panels.find((p) => p.serial === null);
      if (!free) break; // more devices than fields — extras wait
      free.serial = serial;
      free.levelIndex = 0; // a new child starts at the first level
      free.needlePos = d.pos; // set BEFORE startGame so the layout avoids it
      assigned.add(serial);
      this.startGame(free);
    }
  }

  /** (Re)initialise a field's game at its current level. */
  private startGame(p: PanelRuntime): void {
    const preset = this.levelFor(p);
    // Avoid placing a station where the needle already is (no free letters).
    const layout = createLayout(preset, p.needlePos);
    p.stations = layout.stations;
    p.decoys = layout.decoys;
    p.phase = "tuning";
    p.warmth = 0;
    p.displayWarmth = 0;
    p.lockable = false;
    p.directionHint = 0;
    p.lockProgress = 0;
    p.lockingStationId = null;
    p.completeAtMs = null;
  }

  private updatePanel(
    p: PanelRuntime,
    config: GameConfig,
    device: DeviceState | undefined,
    dt: number,
    now: number,
  ): void {
    if (p.phase === "waiting") {
      // drift needle gently to centre so an idle field looks calm
      p.needlePos += (500 - p.needlePos) * (1 - Math.exp(-dt / 400));
      p.warmth = 0;
      p.displayWarmth = 0;
      p.lockable = false;
      p.directionHint = 0;
      p.confetti.update(dt, p.cssH);
      return;
    }

    const preset = this.levelFor(p);

    // Needle follows the device position, smoothed for a fluid feel.
    if (device) {
      const target = clamp(device.pos, 0, 1000);
      p.needlePos += (target - p.needlePos) * (1 - Math.exp(-dt / tokens.timing.needleTauMs));
    }

    if (p.phase === "complete") {
      p.confetti.update(dt, p.cssH);
      if (p.completeAtMs != null && now - p.completeAtMs > tokens.timing.completeHoldMs) {
        // Climb to the next level (green → yellow → red), then stay on the
        // hardest so a child keeps getting fresh red puzzles.
        p.levelIndex = Math.min(p.levelIndex + 1, config.levels.length - 1);
        this.startGame(p);
      }
      return;
    }

    // ---- tuning ----
    // Moving signal (red): slide unfound stations back and forth.
    if (preset.move) stepStationMovement(preset, p.stations, dt);

    // Nearest unfound station → warmth + direction. Decoys raise the "warmth"
    // guide but are never capturable, so they never make the dial go sharp.
    const unfound = p.stations.filter((s) => !s.found);
    let nearest: StationDef | null = null;
    let nearestDist = Infinity;
    for (const s of unfound) {
      const d = Math.abs(p.needlePos - s.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = s;
      }
    }
    const stationWarmth = nearest ? clamp(1 - nearestDist / preset.warmRange, 0, 1) : 0;
    let warmth = stationWarmth;
    for (const dc of p.decoys) {
      const d = Math.abs(p.needlePos - dc.position);
      warmth = Math.max(warmth, clamp(1 - d / preset.warmRange, 0, 1));
    }
    const lockable = !!nearest && nearestDist <= nearest.width / 2;

    p.warmth = warmth;
    // The bar only reads "full" (and the dial only goes fully sharp) when you can
    // actually capture; otherwise it caps below full so a warm-but-uncapturable
    // spot never looks done. This is the fix for "full bar but no point".
    p.displayWarmth = lockable ? 1 : Math.min(warmth, 0.72);
    p.lockable = lockable;
    // A directional nudge once you're warm but not yet on it (helps you chase a
    // moving signal and tells you which way to go).
    p.directionHint =
      nearest && !lockable && stationWarmth > 0.45 ? Math.sign(nearest.position - p.needlePos) : 0;

    // Lock: needle held inside a real station's window for lockMs continuous.
    if (lockable && nearest) {
      if (p.lockingStationId === nearest.id) {
        p.lockProgress += dt / preset.lockMs;
      } else {
        p.lockingStationId = nearest.id;
        p.lockProgress = dt / preset.lockMs;
      }
      if (p.lockProgress >= 1) {
        nearest.found = true;
        nearest.foundAtMs = now;
        p.lockProgress = 0;
        p.lockingStationId = null;
        this.onEvent?.("lock", p.index);
      }
    } else {
      p.lockingStationId = null;
      p.lockProgress = 0;
    }

    // Complete when every station is found.
    if (p.stations.length > 0 && p.stations.every((s) => s.found)) {
      p.phase = "complete";
      p.completeAtMs = now;
      p.confetti.burst(p.cssW, p.cssH, accentFor(getPalette(config.themeMode), p.index));
      this.onEvent?.("complete", p.index);
    }

    p.confetti.update(dt, p.cssH);
  }

  private drawPanel(p: PanelRuntime, config: GameConfig, now: number): void {
    const canvas = p.canvas;
    if (!canvas || p.cssW < 2 || p.cssH < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ensure backing store matches CSS size × dpr.
    const bw = Math.round(p.cssW * p.dpr);
    const bh = Math.round(p.cssH * p.dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      p.bg = null;
    }

    const palette = getPalette(config.themeMode);

    // Rebuild the cached faceplate when size or theme changes.
    const key = `${p.cssW}x${p.cssH}x${p.dpr}x${palette.mode}`;
    if (!p.bg || p.bgKey !== key) {
      p.bg = this.buildFaceplate(p.cssW, p.cssH, p.dpr, palette);
      p.bgKey = key;
    }

    ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
    ctx.clearRect(0, 0, p.cssW, p.cssH);

    drawField(ctx, p.cssW, p.cssH, p.bg, {
      phase: p.phase,
      needlePos: p.needlePos,
      warmth: p.warmth,
      displayWarmth: p.displayWarmth,
      lockable: p.lockable,
      directionHint: p.directionHint,
      lockProgress: p.lockProgress,
      lockingStationId: p.lockingStationId,
      stations: p.stations,
      nowMs: now,
      completeAtMs: p.completeAtMs,
      accent: accentFor(palette, p.index),
      preset: this.levelFor(p),
      palette,
    });

    // Confetti sits above the dial during the celebration.
    if (p.confetti.active) {
      const g = fieldGeometry(p.cssW, p.cssH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.glass.x, g.glass.y, g.glass.w, g.glass.h);
      ctx.clip();
      p.confetti.draw(ctx);
      ctx.restore();
    }
  }

  private buildFaceplate(
    cssW: number,
    cssH: number,
    dpr: number,
    palette: Palette,
  ): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFaceplate(ctx, cssW, cssH, palette);
    return c;
  }

  private pushSnapshots(config: GameConfig, now: number): void {
    const devices = store.get().devices;
    const snaps: PanelSnapshot[] = this.panels.map((p) => {
      const preset = this.levelFor(p);
      const total = p.stations.length || stationCountFor(preset);
      const revealed: RevealItem[] = p.stations.map((s) => ({
        id: s.id,
        payload: s.found ? s.payload : "",
        position: s.position,
        foundAtMs: s.foundAtMs,
      }));
      const device = p.serial ? devices[p.serial] : undefined;
      return {
        index: p.index,
        serial: p.serial,
        phase: p.phase,
        needlePos: p.needlePos,
        warmth: p.warmth,
        displayWarmth: p.displayWarmth,
        lockable: p.lockable,
        directionHint: p.directionHint,
        lockProgress: p.lockProgress,
        lockingStationId: p.lockingStationId,
        foundCount: p.stations.filter((s) => s.found).length,
        totalStations: total,
        revealed,
        messageMode: preset.messageMode,
        message: preset.message,
        pictureId: preset.pictureId,
        completeAtMs: p.completeAtMs,
        themeId: config.themeId,
        levelIndex: p.levelIndex,
        levelId: preset.id,
        levelLabel: preset.label,
        ageMs: device ? now - device.lastSeenMs : -1,
      };
    });
    store.get().setSnapshots(snaps);
    // Keep the debug device-table ages fresh (only while the panel is open).
    if (store.get().debug.visible) store.get().setDebug({ clockMs: now });
  }

  private trackFps(now: number, frameMs: number): void {
    this.frameTimes.push(now);
    while (this.frameTimes.length > 0 && now - this.frameTimes[0] > 1000) {
      this.frameTimes.shift();
    }
    const dbg = store.get().debug;
    if (dbg.visible && (dbg.showFps || dbg.showOverlays)) {
      // Update ~4×/sec to avoid churn.
      if (Math.floor(now / 250) !== Math.floor((now - 16) / 250)) {
        store.get().setDebug({
          fps: this.frameTimes.length,
          renderLatencyMs: Math.round(frameMs * 10) / 10,
        });
      }
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ---- Singleton -------------------------------------------------------------
let engineSingleton: GameEngine | null = null;
export function getEngine(): GameEngine {
  if (!engineSingleton) engineSingleton = new GameEngine();
  return engineSingleton;
}
