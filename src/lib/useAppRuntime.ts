"use client";

import { useEffect } from "react";
import { store } from "@/game/store";
import { getEngine } from "@/game/engine";
import { getSimulator, type SimMode } from "@/sim/simulator";
import { getSerialManager } from "@/serial/webserial";
import { getAudio } from "@/audio/sound";
import { getPalette, type ThemeMode } from "@/game/palette";
import { FIELD_COUNT_MAX } from "@/game/presets";
import type { DifficultyPreset, GameConfig } from "@/game/types";

const NUDGE_STEP = 25;
const CONFIG_KEY = "frekvens-config";
// Bump when the level/preset schema changes so saved levels reset to new defaults.
const CONFIG_VERSION = 3;

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const pal = getPalette(mode);
  const root = document.documentElement;
  root.style.backgroundColor = pal.pageBg;
  root.style.colorScheme = mode;
  root.setAttribute("data-theme", mode);
}

/**
 * Boots the client runtime: engine loop, simulator, serial, optional audio,
 * theme persistence, keyboard shortcuts, URL params, and the window.__frekvens
 * test API used by the Playwright screenshot script.
 */
export function useAppRuntime() {
  useEffect(() => {
    const engine = getEngine();
    const sim = getSimulator();
    const serial = getSerialManager();
    const audio = getAudio();

    engine.setSimulator(sim);
    engine.setEventHandler((type) => {
      const cfg = store.get().config;
      if (!cfg.soundEnabled) return;
      if (type === "lock") audio.playLock();
      else if (type === "complete") audio.playComplete();
    });
    serial.init();

    // ---- settings: restore from localStorage, then persist on change ----
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<GameConfig> & { _v?: number };
        // On a level-schema change, keep the operator's prefs (fields, theme,
        // sound) but reset the difficulty levels to the new defaults.
        const restore = saved._v === CONFIG_VERSION ? saved : { ...saved, levels: undefined };
        store.get().hydrateConfig(restore);
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    applyTheme(store.get().config.themeMode);
    const unsubConfig = store.subscribe((state, prev) => {
      // config is only replaced by config actions, so device/snapshot updates
      // (which fire many times per second) don't trigger a write.
      if (state.config === prev.config) return;
      applyTheme(state.config.themeMode);
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...state.config, _v: CONFIG_VERSION }));
      } catch {
        /* ignore */
      }
    });

    // If sound was left on in a previous session, resume audio on the first user
    // gesture (browsers require a gesture to start an AudioContext).
    const resumeAudio = () => {
      if (store.get().config.soundEnabled) void audio.enable();
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
    };
    window.addEventListener("pointerdown", resumeAudio);
    window.addEventListener("keydown", resumeAudio);

    // ---- URL parameters ----
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") store.get().setDebug({ visible: true });
    const themeParam = params.get("themeMode");
    if (themeParam === "light" || themeParam === "dark") store.get().setThemeMode(themeParam);
    const fields = Number(params.get("fields"));
    if (Number.isFinite(fields) && fields >= 1) store.get().setFieldCount(fields);
    const theme = params.get("theme");
    if (theme) store.get().setThemeId(theme);
    if (params.get("sim") === "1" || params.get("sim") === "true") {
      store.get().setSimEnabled(true);
      const count = Number(params.get("devices")) || store.get().config.fieldCount;
      const mode = (params.get("mode") as SimMode) || "sweep";
      sim.ensureCount(count, mode);
    }

    engine.start();

    // ---- window test API ----
    const patchAllLevels = (patch: Partial<DifficultyPreset>) => {
      const n = store.get().config.levels.length;
      for (let i = 0; i < n; i++) store.get().patchLevel(i, patch);
      engine.regenerateAll();
    };
    const api = {
      store,
      enableSim: () => store.get().setSimEnabled(true),
      disableSim: () => {
        store.get().setSimEnabled(false);
        sim.removeAll();
      },
      setFields: (n: number) => store.get().setFieldCount(n),
      setTheme: (id: string) => store.get().setThemeId(id),
      setThemeMode: (m: ThemeMode) => store.get().setThemeMode(m),
      setAllLevel: (idx: number) => engine.setAllToLevel(idx),
      setMessageMode: (m: "word" | "image") => patchAllLevels({ messageMode: m }),
      setPicture: (id: string) => patchAllLevels({ pictureId: id }),
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
      warmField: (fieldIndex: number, offset = 70) => {
        const serialId = store.get().snapshots[fieldIndex]?.serial;
        if (!serialId) return;
        const target = engine.solveTargetFor(serialId);
        if (target != null) sim.setPos(serialId, target - offset);
      },
      lockOn: (fieldIndex: number) => {
        const serialId = store.get().snapshots[fieldIndex]?.serial;
        if (!serialId) return;
        const target = engine.solveTargetFor(serialId);
        if (target != null) sim.setPos(serialId, target);
      },
      solveField: (i: number) => {
        const serialId = store.get().snapshots[i]?.serial;
        if (serialId) sim.setMode(serialId, "solve");
      },
      revealCount: (i: number, k: number) => engine.revealCount(i, k),
      revealAllStations: (i: number) => engine.revealAll(i),
      resetField: (i: number) => engine.resetPanelToStart(i),
      resetAll: () => engine.resetAllToStart(),
      showDebug: (b: boolean) => store.get().setDebug({ visible: b }),
    };
    (window as unknown as { __frekvens: typeof api }).__frekvens = api;

    // ---- keyboard shortcuts (test-control the "vip"/needle from the PC) ----
    const TEXT_TYPES = ["text", "number", "search", "email", "url", "password", "tel"];
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const type = (el as HTMLInputElement | null)?.type;
      // Only ignore shortcuts while typing in a text field (so the caret can
      // move). Arrows still control the needle when a slider/select is focused.
      const typing = tag === "TEXTAREA" || (tag === "INPUT" && TEXT_TYPES.includes(type ?? ""));
      if (typing) return;

      if (e.key === "d" || e.key === "D") {
        store.get().toggleDebug();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === "0" ? 9 : Number(e.key) - 1;
        if (idx < store.get().config.fieldCount) store.get().setActiveField(idx);
        return;
      }
      const active = store.get().debug.activeField;
      const serialId = store.get().snapshots[active]?.serial;
      const step = e.shiftKey ? 60 : NUDGE_STEP; // hold Shift for a bigger step
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // preventDefault so a focused slider/select doesn't also react.
        e.preventDefault();
        if (serialId) sim.nudge(serialId, e.key === "ArrowLeft" ? -step : step);
      } else if (e.key === "r" || e.key === "R") {
        engine.resetAllToStart();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
      unsubConfig();
      engine.stop();
    };
  }, []);
}

export { FIELD_COUNT_MAX };
