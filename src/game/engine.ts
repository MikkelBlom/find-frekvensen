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

import { createLayout, hopStations, stationCountFor } from "./gameFactory";
import { store } from "./store";
import { tokens } from "./tokens";
import { fieldTheme } from "./themes";
import type {
  DecoyDef,
  DeviceState,
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

  stations: StationDef[];
  decoys: DecoyDef[];

  needlePos: number;
  warmth: number;
  displayWarmth: number;
  lockProgress: number;
  lockingStationId: string | null;

  completeAtMs: number | null;
  lastHopMs: number;

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

  /** Force a fresh game on a field (debug reset / difficulty change). */
  resetPanel(index: number): void {
    const p = this.panels[index];
    if (p) this.startGame(p);
  }
  resetAll(): void {
    for (const p of this.panels) if (p.serial) this.startGame(p);
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
      stations: [],
      decoys: [],
      needlePos: 500,
      warmth: 0,
      displayWarmth: 0,
      lockProgress: 0,
      lockingStationId: null,
      completeAtMs: null,
      lastHopMs: 0,
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
      assigned.add(serial);
      this.startGame(free);
      free.needlePos = d.pos;
    }
  }

  /** (Re)initialise a field's game from the current preset. */
  private startGame(p: PanelRuntime): void {
    const { preset } = store.get().config;
    const layout = createLayout(preset);
    p.stations = layout.stations;
    p.decoys = layout.decoys;
    p.phase = "tuning";
    p.warmth = 0;
    p.displayWarmth = 0;
    p.lockProgress = 0;
    p.lockingStationId = null;
    p.completeAtMs = null;
    p.lastHopMs = performance.now();
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
      p.confetti.update(dt, p.cssH);
      return;
    }

    const preset = config.preset;

    // Needle follows the device position, smoothed for a fluid feel.
    if (device) {
      const target = clamp(device.pos, 0, 1000);
      p.needlePos += (target - p.needlePos) * (1 - Math.exp(-dt / tokens.timing.needleTauMs));
    }

    if (p.phase === "complete") {
      p.confetti.update(dt, p.cssH);
      if (p.completeAtMs != null && now - p.completeAtMs > tokens.timing.completeHoldMs) {
        // Auto-reset for the next child (device still present).
        this.startGame(p);
      }
      return;
    }

    // ---- tuning ----
    // Frequency hopping (red difficulty).
    if (preset.hop && now - p.lastHopMs > preset.hopIntervalMs) {
      hopStations(preset, p.stations);
      p.lastHopMs = now;
      // A hop can move the target out from under the needle — drop any lock.
      p.lockProgress = 0;
      p.lockingStationId = null;
    }

    // Warmth (real) toward nearest unfound station; displayWarmth adds decoys.
    const unfound = p.stations.filter((s) => !s.found);
    let realWarmth = 0;
    let nearest: StationDef | null = null;
    let nearestDist = Infinity;
    for (const s of unfound) {
      const d = Math.abs(p.needlePos - s.position);
      const w = clamp(1 - d / preset.warmRange, 0, 1);
      if (w > realWarmth) realWarmth = w;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = s;
      }
    }
    let displayWarmth = realWarmth;
    for (const dc of p.decoys) {
      const d = Math.abs(p.needlePos - dc.position);
      const w = clamp(1 - d / preset.warmRange, 0, 1);
      if (w > displayWarmth) displayWarmth = w;
    }
    p.warmth = realWarmth;
    p.displayWarmth = displayWarmth;

    // Lock: needle held inside a real station's window for lockMs continuous.
    if (nearest && Math.abs(p.needlePos - nearest.position) <= nearest.width / 2) {
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
      p.confetti.burst(p.cssW, p.cssH, fieldTheme(config.themeId, p.index).accent);
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

    // Rebuild the cached faceplate when size changes.
    const key = `${p.cssW}x${p.cssH}x${p.dpr}`;
    if (!p.bg || p.bgKey !== key) {
      p.bg = this.buildFaceplate(p.cssW, p.cssH, p.dpr);
      p.bgKey = key;
    }

    ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
    ctx.clearRect(0, 0, p.cssW, p.cssH);

    const accent = fieldTheme(config.themeId, p.index).accent;
    drawField(ctx, p.cssW, p.cssH, p.bg, {
      phase: p.phase,
      needlePos: p.needlePos,
      warmth: p.warmth,
      displayWarmth: p.displayWarmth,
      lockProgress: p.lockProgress,
      lockingStationId: p.lockingStationId,
      stations: p.stations,
      nowMs: now,
      completeAtMs: p.completeAtMs,
      accent,
      preset: config.preset,
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

  private buildFaceplate(cssW: number, cssH: number, dpr: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFaceplate(ctx, cssW, cssH);
    return c;
  }

  private pushSnapshots(config: GameConfig, now: number): void {
    const devices = store.get().devices;
    const snaps: PanelSnapshot[] = this.panels.map((p) => {
      const total = p.stations.length || stationCountFor(config.preset);
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
        lockProgress: p.lockProgress,
        lockingStationId: p.lockingStationId,
        foundCount: p.stations.filter((s) => s.found).length,
        totalStations: total,
        revealed,
        messageMode: config.preset.messageMode,
        message: config.preset.message,
        pictureId: config.preset.pictureId,
        completeAtMs: p.completeAtMs,
        themeId: config.themeId,
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
