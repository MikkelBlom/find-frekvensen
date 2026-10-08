// Turns a difficulty preset into a concrete, freshly-randomised field layout:
// hidden stations (each carrying one letter or picture-tile) plus optional
// decoys. Also steps station drift for moving levels.
//
// Word-mode: one station per letter of the message, payload = the letter.
// Image-mode: one station per picture tile, payload = the tile index in reading
// order, so the picture always assembles correctly regardless of find order.
//
// IMPORTANT: nothing is placed in a dead-zone around the needle's CURRENT
// position at (re)start. The needle sits somewhere when a game begins; a station
// spawned there would be captured for free without tuning. Keeping that spot
// clear means every child has to actually hunt.

import { pictureTileCount } from "./pictures";
import type { DecoyDef, DifficultyPreset, StationDef } from "./types";

const DIAL_MIN = 0;
const DIAL_MAX = 1000;
const EDGE_MARGIN = 70;
const USABLE_LO = DIAL_MIN + EDGE_MARGIN;
const USABLE_HI = DIAL_MAX - EDGE_MARGIN;
const NEEDLE_DEADZONE = 140; // no station/decoy within ±this of the needle at start

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

/** Parts of [lo, hi] that lie outside a dead-zone around `avoid`. */
function usableSegments(lo: number, hi: number, avoid: number): Segment[] {
  const dzLo = avoid - NEEDLE_DEADZONE;
  const dzHi = avoid + NEEDLE_DEADZONE;
  const segs: Segment[] = [];
  if (lo < dzLo) segs.push([lo, Math.min(hi, dzLo)]);
  if (hi > dzHi) segs.push([Math.max(lo, dzHi), hi]);
  // If the spread sits entirely inside the dead-zone, fall back to the whole
  // usable dial (minus the dead-zone) so stations still have somewhere to go.
  if (segs.length === 0) {
    const out: Segment[] = [];
    if (USABLE_LO < dzLo) out.push([USABLE_LO, Math.min(USABLE_HI, dzLo)]);
    if (USABLE_HI > dzHi) out.push([Math.max(USABLE_LO, dzHi), USABLE_HI]);
    return out.length ? out : [[USABLE_LO, USABLE_HI]];
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
  return segs[segs.length - 1][1];
}

function segmentsLength(segs: Segment[]): number {
  return segs.reduce((a, [s, e]) => a + (e - s), 0);
}

/** Fisher–Yates shuffle (in place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Evenly distribute `count` positions across the segments, with jitter. */
function placeInSegments(segs: Segment[], count: number, jitterFrac: number): number[] {
  const total = segmentsLength(segs);
  const cell = total / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let t = cell * (i + 0.5) + rand(-cell * jitterFrac, cell * jitterFrac);
    t = clamp(t, 0, total - 0.001);
    out.push(mapToSegments(t, segs));
  }
  return out;
}

/**
 * Build a fresh, randomised layout. `avoidPos` is the needle's current position;
 * no station/decoy is placed within NEEDLE_DEADZONE of it.
 */
export function createLayout(preset: DifficultyPreset, avoidPos = 500): FieldLayout {
  const count = stationCountFor(preset);

  // Neighbouring capture windows must not touch: two stations on one spot
  // would hand out two letters for one find. Widest possible window + margin.
  const minGap = preset.width * (1 + preset.widthJitter) * 1.15;

  // Start from the preset's spread; if the needle's dead-zone eats so much of
  // it that stations would crowd together, widen the spread until they fit
  // (up to the whole dial).
  const usableSpan = USABLE_HI - USABLE_LO;
  let spread = clamp01(preset.spread);
  let segs: Segment[];
  for (;;) {
    const span = usableSpan * spread;
    const lo = Math.max(USABLE_LO, 500 - span / 2);
    const hi = Math.min(USABLE_HI, 500 + span / 2);
    segs = usableSegments(lo, hi, avoidPos);
    if (segmentsLength(segs) / count >= minGap * 1.6 || spread >= 1) break;
    spread = Math.min(1, spread + 0.05);
  }

  // Jitter at most what keeps neighbours ≥ minGap apart (cell·(1−2j) ≥ minGap).
  const cell = segmentsLength(segs) / count;
  const jitter = clamp((1 - minGap / cell) / 2, 0, 0.28);
  // Shuffle so the letters aren't laid out left-to-right in message order —
  // otherwise the dial position gives away where the next letter is.
  const positions = shuffle(placeInSegments(segs, count, jitter));

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
      moveTarget: null,
    };
  });

  const decoys = placeDecoys(preset, stations, avoidPos);
  return { stations, decoys };
}

function placeDecoys(preset: DifficultyPreset, stations: StationDef[], avoidPos: number): DecoyDef[] {
  const decoys: DecoyDef[] = [];
  const minGap = preset.warmRange * 0.8; // a decoy must be clearly separate
  let attempts = 0;
  while (decoys.length < preset.decoys && attempts < 200) {
    attempts++;
    const pos = rand(USABLE_LO, USABLE_HI);
    const tooClose =
      Math.abs(pos - avoidPos) < NEEDLE_DEADZONE ||
      stations.some((s) => Math.abs(s.position - pos) < minGap) ||
      decoys.some((d) => Math.abs(d.position - pos) < minGap);
    if (!tooClose) decoys.push({ id: `decoy-${decoys.length}`, position: pos });
  }
  return decoys;
}

/**
 * Advance drifting stations (moving levels). Each unfound station wanders back
 * and forth around its home position at a moderate speed, so the child has to
 * follow the signal rather than park on it.
 */
export function stepStationMovement(preset: DifficultyPreset, stations: StationDef[], dtMs: number): void {
  if (!preset.move || preset.moveSpeed <= 0) return;
  const step = preset.moveSpeed * (dtMs / 1000);
  for (const s of stations) {
    if (s.found) continue;
    if (s.moveTarget == null) s.moveTarget = pickDriftTarget(s.basePosition, s.position, preset.moveRange);
    const diff = s.moveTarget - s.position;
    if (Math.abs(diff) <= step) {
      s.position = s.moveTarget;
      s.moveTarget = pickDriftTarget(s.basePosition, s.position, preset.moveRange);
    } else {
      s.position += Math.sign(diff) * step;
    }
  }
}

/** A new drift target: a meaningful distance away, biased to reverse direction. */
function pickDriftTarget(base: number, current: number, range: number): number {
  const side = current >= base ? -1 : 1; // head back toward/past home
  const dist = rand(range * 0.4, range);
  return clamp(base + side * dist, USABLE_LO, USABLE_HI);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
