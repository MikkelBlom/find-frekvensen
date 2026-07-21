// Simulator — generates virtual receiver devices so the entire game is
// developable, testable and screenshot-able without a single micro:bit.
//
// Each virtual device writes into the SAME device map the serial reader uses
// (store.upsertDevice), at a realistic ~10 Hz, so from the engine's point of
// view sim and hardware are indistinguishable.
//
// Modes:
//   manual – position controlled externally (debug slider / arrow keys)
//   sweep  – auto oscillates across the dial (a lively idle demo)
//   solve  – auto-hunts: drives toward the nearest unfound station and holds,
//            so a field will actually complete (used for demos + screenshots)
//   idle   – sits still

import { store } from "@/game/store";
import type { SimDeviceMeta } from "@/game/store";
import { getEngine } from "@/game/engine";

export type SimMode = SimDeviceMeta["mode"];

interface VirtualDevice {
  serial: string;
  pos: number;
  mode: SimMode;
  sweepDir: number;
  sweepSpeed: number; // dial units / second
  flags: number;
  sendAccumMs: number;
}

const SEND_INTERVAL_MS = 100; // ~10 packets/sec, like the firmware

export class Simulator {
  private devices = new Map<string, VirtualDevice>();
  private nextId = 1;

  /** Add a virtual device; returns its serial. */
  add(mode: SimMode = "sweep"): string {
    const serial = `SIM-${this.nextId++}`;
    this.devices.set(serial, {
      serial,
      pos: 200 + Math.random() * 600,
      mode,
      sweepDir: Math.random() < 0.5 ? 1 : -1,
      sweepSpeed: 260 + Math.random() * 120,
      flags: 0,
      sendAccumMs: Math.random() * SEND_INTERVAL_MS,
    });
    this.syncMeta();
    return serial;
  }

  remove(serial: string): void {
    if (this.devices.delete(serial)) {
      store.get().removeDevice(serial);
      this.syncMeta();
    }
  }

  removeAll(): void {
    for (const serial of this.devices.keys()) store.get().removeDevice(serial);
    this.devices.clear();
    this.syncMeta();
  }

  /** Ensure exactly `n` devices exist, all in the given mode. */
  ensureCount(n: number, mode: SimMode = "sweep"): void {
    while (this.devices.size < n) this.add(mode);
    const extra = [...this.devices.keys()].slice(n);
    for (const serial of extra) this.remove(serial);
    for (const vd of this.devices.values()) vd.mode = mode;
    this.syncMeta();
  }

  setMode(serial: string, mode: SimMode): void {
    const vd = this.devices.get(serial);
    if (vd) {
      vd.mode = mode;
      this.syncMeta();
    }
  }
  setAllModes(mode: SimMode): void {
    for (const vd of this.devices.values()) vd.mode = mode;
    this.syncMeta();
  }

  setPos(serial: string, pos: number): void {
    const vd = this.devices.get(serial);
    if (vd) {
      vd.mode = "manual";
      vd.pos = clamp(pos, 0, 1000);
      // push immediately for responsive slider/keyboard control
      store.get().upsertDevice(serial, Math.round(vd.pos), vd.flags);
      this.syncMeta();
    }
  }
  nudge(serial: string, delta: number): void {
    const vd = this.devices.get(serial);
    if (vd) this.setPos(serial, vd.pos + delta);
  }
  pressButton(serial: string, which: "A" | "B"): void {
    const vd = this.devices.get(serial);
    if (!vd) return;
    vd.flags |= which === "A" ? 1 : 2;
    // Buttons fine-tune position (mirrors firmware behaviour).
    this.nudge(serial, which === "A" ? -12 : 12);
  }

  list(): SimDeviceMeta[] {
    return [...this.devices.values()].map((v) => ({ serial: v.serial, mode: v.mode }));
  }

  /** Advance all virtual devices; called by the engine loop when sim enabled. */
  tick(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const vd of this.devices.values()) {
      switch (vd.mode) {
        case "sweep": {
          vd.pos += vd.sweepDir * vd.sweepSpeed * dt;
          if (vd.pos >= 1000) {
            vd.pos = 1000;
            vd.sweepDir = -1;
          } else if (vd.pos <= 0) {
            vd.pos = 0;
            vd.sweepDir = 1;
          }
          break;
        }
        case "solve": {
          const target = getEngine().solveTargetFor(vd.serial);
          if (target == null) {
            // nothing to hunt (waiting/complete) — drift gently
            vd.pos += (500 - vd.pos) * (1 - Math.exp(-dt / 0.6));
          } else {
            const step = 520 * dt; // units/sec
            const diff = target - vd.pos;
            vd.pos += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
          }
          break;
        }
        case "manual":
        case "idle":
        default:
          break;
      }

      vd.sendAccumMs += dtMs;
      if (vd.sendAccumMs >= SEND_INTERVAL_MS) {
        vd.sendAccumMs = 0;
        store.get().upsertDevice(vd.serial, Math.round(clamp(vd.pos, 0, 1000)), vd.flags);
        vd.flags = 0;
      }
    }
  }

  private syncMeta(): void {
    store.get().setSimDevices(this.list());
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

let simSingleton: Simulator | null = null;
export function getSimulator(): Simulator {
  if (!simSingleton) simSingleton = new Simulator();
  return simSingleton;
}
