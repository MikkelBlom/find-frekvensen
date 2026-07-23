// Turns a difficulty preset into a concrete, freshly-randomised field layout:
// hidden stations (each carrying one letter or picture-tile) plus decoy peaks.
//
// Word-mode: one station per letter of the message, payload = the letter.
// Image-mode: one station per picture tile, payload = the tile index in reading
// order, so the picture always assembles correctly regardless of find order.
//
// IMPORTANT: nothing is placed in a dead-zone around the centre of the dial.
// The needle starts in the middle (a level micro:bit reports the centre), so a
// station there would be locked instantly without tuning. Keeping the centre
// clear means every child has to actually hunt.

import { pictureTileCount } from "./pictures";
import type { DecoyDef, DifficultyPreset, StationDef } from "./types";

const DIAL_MIN = 0;
const DIAL_MAX = 1000;
const EDGE_MARGIN = 70;
const CENTER = 500;
const CENTER_DEADZONE = 120; // no station/decoy within ±this of the centre

export interface FieldLayout {
  stations: StationDef[];
  decoys: DecoyDef[];
}

/** Sanitised letters used for word-mode (uppercase A–Z + Danish ÆØÅ). */
function messageLetters(message: string): string[] {
  return message
    .toUpperCase()
    .split("")
    .filter((c) => /[A-ZÆØÅ0-9]/.test(c));
}

/** Number of stations a preset produces in its current mode. */
export function stationCountFor(preset: DifficultyPreset): number {
  if (preset.messageMode === "image") return pictureTileCount(preset.pictureId);
  const letters = messageLetters(preset.message);
  return Math.max(1, letters.length);
}

/** Payload string for station i (letter or tile index). */
function payloadFor(preset: DifficultyPreset, i: number): string {
  if (preset.messageMode === "image") return String(i);
  const letters = messageLetters(preset.message);
  return letters[i] ?? "?";
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

type Segment = [number, number];

/** The parts of [lo, hi] that lie outside the centre dead-zone. */
function usableSegments(lo: number, hi: number): Segment[] {
  const dzLo = CENTER - CENTER_DEADZONE;
  const dzHi = CENTER + CENTER_DEADZONE;
  const segs: Segment[] = [];
  if (lo < dzLo) segs.push([lo, Math.min(hi, dzLo)]);
  if (hi > dzHi) segs.push([Math.max(lo, dzHi), hi]);
  // If the whole spread sits inside the dead-zone, fall back to the full dial
  // (minus the dead-zone) so stations still have somewhere to go.
  if (segs.length === 0) {
    return [
      [DIAL_MIN + EDGE_MARGIN, dzLo],
      [dzHi, DIAL_MAX - EDGE_MARGIN],
    ];
  }
  return segs;
}

/** Map a 0..totalLength parameter onto concatenated segments (never the gap). */
function mapToSegments(t: number, segs: Segment[]): number {
  let acc = 0;
  for (const [s, e] of segs) {
    const len = e - s;
    if (t <= acc + len) return s + (t - acc);
    acc += len;
  }
  const last = segs[segs.length - 1];
  return last[1];
}

/** Evenly distribute `count` positions across the segments, with jitter. */
function placeInSegments(segs: Segment[], count: number, jitterFrac: number): number[] {
  const total = segs.reduce((a, [s, e]) => a + (e - s), 0);
  const cell = total / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let t = cell * (i + 0.5) + rand(-cell * jitterFrac, cell * jitterFrac);
    t = clamp(t, 0, total - 0.001);
    out.push(mapToSegments(t, segs));
  }
  return out;
}

/** Build a fresh, randomised layout for one field from a preset. */
export function createLayout(preset: DifficultyPreset): FieldLayout {
  const count = stationCountFor(preset);

  const usableLo = DIAL_MIN + EDGE_MARGIN;
  const usableHi = DIAL_MAX - EDGE_MARGIN;
  const usableSpan = usableHi - usableLo;
  const span = usableSpan * clamp01(preset.spread);
  const lo = Math.max(usableLo, CENTER - span / 2);
  const hi = Math.min(usableHi, CENTER + span / 2);

  const segs = usableSegments(lo, hi);
  const positions = placeInSegments(segs, count, 0.28);

  const stations: StationDef[] = positions.map((position, i) => {
    const width = Math.max(
      24,
      preset.width * (1 + rand(-preset.widthJitter, preset.widthJitter)),
    );
    return {
      id: `st-${i}`,
      position,
      basePosition: position,
      width,
      payload: payloadFor(preset, i),
      found: false,
      foundAtMs: null,
    };
  });

  const decoys = placeDecoys(preset, stations, usableLo, usableHi);
  return { stations, decoys };
}

function placeDecoys(
  preset: DifficultyPreset,
  stations: StationDef[],
  lo: number,
  hi: number,
): DecoyDef[] {
  const decoys: DecoyDef[] = [];
  const minGap = preset.warmRange * 0.8; // a decoy must be clearly separate
  let attempts = 0;
  while (decoys.length < preset.decoys && attempts < 200) {
    attempts++;
    const pos = rand(lo, hi);
    const tooClose =
      Math.abs(pos - CENTER) < CENTER_DEADZONE || // keep the centre clear too
      stations.some((s) => Math.abs(s.position - pos) < minGap) ||
      decoys.some((d) => Math.abs(d.position - pos) < minGap);
    if (!tooClose) {
      decoys.push({ id: `decoy-${decoys.length}`, position: pos });
    }
  }
  return decoys;
}

/** A random dial position outside the centre dead-zone. */
function randomOutsideCenter(lo: number, hi: number): number {
  const segs = usableSegments(lo, hi);
  const total = segs.reduce((a, [s, e]) => a + (e - s), 0);
  return mapToSegments(Math.random() * total, segs);
}

/** Move unfound stations to fresh positions (frequency hopping). */
export function hopStations(preset: DifficultyPreset, stations: StationDef[]): void {
  const unfound = stations.filter((s) => !s.found);
  const usableLo = DIAL_MIN + EDGE_MARGIN;
  const usableHi = DIAL_MAX - EDGE_MARGIN;

  // "last": only hop when a single station remains — a dramatic, understandable
  // finale where just the final signal keeps jumping. "all": every unfound
  // station hops each interval.
  const hopping =
    preset.hopMode === "last"
      ? unfound.length === 1
        ? unfound
        : []
      : unfound;

  for (const s of hopping) {
    let target = randomOutsideCenter(usableLo, usableHi);
    // Nudge it a meaningful distance from where it was, so a hop is noticeable.
    if (Math.abs(target - s.position) < 180) {
      target = clamp(
        s.position + (Math.random() < 0.5 ? -1 : 1) * rand(180, 320),
        usableLo,
        usableHi,
      );
      // Keep it out of the dead-zone after the nudge.
      if (Math.abs(target - CENTER) < CENTER_DEADZONE) {
        target = randomOutsideCenter(usableLo, usableHi);
      }
    }
    s.position = target;
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
