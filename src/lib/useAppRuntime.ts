"use client";

import { useEffect } from "react";
import { store } from "@/game/store";
import { getEngine } from "@/game/engine";
import { getSimulator, type SimMode } from "@/sim/simulator";
import { getSerialManager } from "@/serial/webserial";
import { getAudio } from "@/audio/sound";
import { FIELD_COUNT_MAX } from "@/game/presets";

const NUDGE_STEP = 25;

/**
 * Boots the whole client runtime: starts the engine loop, wires the simulator,
 * serial reader and (optional) audio, installs keyboard shortcuts, applies URL
 * parameters, and exposes a small window.__frekvens API used by the Playwright
 * screenshot script to drive deterministic states.
 */
export function useAppRuntime() {
  useEffect(() => {
    const engine = getEngine();
    const sim = getSimulator();
    const serial = getSerialManager();
    const audio = getAudio();

    engine.setSimulator(sim);
    engine.setEventHandler((type, index) => {
      const cfg = store.get().config;
      if (!cfg.soundEnabled) return;
      if (type === "lock") audio.playLock();
      else if (type === "complete") audio.playComplete();
      void index;
    });
    serial.init();

    // ---- URL parameters (e.g. ?sim=1&fields=6&preset=yellow&debug=1) ----
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") store.get().setDebug({ visible: true });
    const fields = Number(params.get("fields"));
    if (Number.isFinite(fields) && fields >= 1) store.get().setFieldCount(fields);
    const preset = params.get("preset");
    if (preset) store.get().setPreset(preset);
    const theme = params.get("theme");
    if (theme) store.get().setThemeId(theme);
    if (params.get("sim") === "1" || params.get("sim") === "true") {
      store.get().setSimEnabled(true);
      const count = Number(params.get("devices")) || store.get().config.fieldCount;
      const mode = (params.get("mode") as SimMode) || "sweep";
      sim.ensureCount(count, mode);
    }

    engine.start();

    // ---- window test API (for Playwright / manual debugging) ----
    const api = {
      store,
      enableSim: () => store.get().setSimEnabled(true),
      disableSim: () => {
        store.get().setSimEnabled(false);
        sim.removeAll();
      },
      setFields: (n: number) => store.get().setFieldCount(n),
      setPreset: (id: string) => store.get().setPreset(id),
      setTheme: (id: string) => store.get().setThemeId(id),
      setMessageMode: (m: "word" | "image") => store.get().patchPreset({ messageMode: m }),
      setPicture: (id: string) => store.get().patchPreset({ pictureId: id }),
      setSound: (on: boolean) => store.get().setSoundEnabled(on),
      addDevices: (n: number, mode: SimMode = "sweep") => {
        store.get().setSimEnabled(true);
        sim.ensureCount(n, mode);
      },
      setAllModes: (mode: SimMode) => sim.setAllModes(mode),
      removeAll: () => sim.removeAll(),
      setPos: (fieldIndex: number, pos: number) => {
        const serialId = store.get().snapshots[fieldIndex]?.serial;
        if (serialId) sim.setPos(serialId, pos);
      },
      // Park a field's needle just outside a station's lock window: a warm,
      // clearing-signal state that will not auto-lock. For screenshots.
      warmField: (fieldIndex: number, offset = 70) => {
        const serialId = store.get().snapshots[fieldIndex]?.serial;
        if (!serialId) return;
        const target = engine.solveTargetFor(serialId);
        if (target != null) sim.setPos(serialId, target - offset);
      },
      // Park a field's needle exactly on a station so the lock ring fills.
      lockOn: (fieldIndex: number) => {
        const serialId = store.get().snapshots[fieldIndex]?.serial;
        if (!serialId) return;
        const target = engine.solveTargetFor(serialId);
        if (target != null) sim.setPos(serialId, target);
      },
      revealField: (i: number) => engine.resetPanel(i),
      solveField: (i: number) => {
        const serialId = store.get().snapshots[i]?.serial;
        if (serialId) sim.setMode(serialId, "solve");
      },
      revealAllStations: (i: number) => engine.revealAll(i),
      revealCount: (i: number, k: number) => engine.revealCount(i, k),
      resetAll: () => engine.resetAll(),
      showDebug: (b: boolean) => store.get().setDebug({ visible: b }),
    };
    (window as unknown as { __frekvens: typeof api }).__frekvens = api;

    // ---- keyboard shortcuts ----
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "d" || e.key === "D") {
        store.get().toggleDebug();
        return;
      }
      // digit keys select the active field
      if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === "0" ? 9 : Number(e.key) - 1;
        if (idx < store.get().config.fieldCount) store.get().setActiveField(idx);
        return;
      }
      const active = store.get().debug.activeField;
      const serialId = store.get().snapshots[active]?.serial;
      if (e.key === "ArrowLeft") {
        if (serialId) sim.nudge(serialId, -NUDGE_STEP);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        if (serialId) sim.nudge(serialId, NUDGE_STEP);
        e.preventDefault();
      } else if (e.key === "r" || e.key === "R") {
        engine.resetAll();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      engine.stop();
    };
  }, []);
}

export { FIELD_COUNT_MAX };
