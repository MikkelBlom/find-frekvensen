// Turns a difficulty preset into a concrete, freshly-randomised field layout:
// hidden stations (each carrying one letter or picture-tile) plus decoy peaks.
//
// Word-mode: one station per letter of the message, payload = the letter.
// Image-mode: one station per picture tile, payload = the tile index in reading
// order, so the picture always assembles correctly regardless of find order.

import { pictureTileCount } from "./pictures";
import type { DecoyDef, DifficultyPreset, StationDef } from "./types";

const DIAL_MIN = 0;
const DIAL_MAX = 1000;
const EDGE_MARGIN = 70;

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

/** Build a fresh, randomised layout for one field from a preset. */
export function createLayout(preset: DifficultyPreset): FieldLayout {
  const count = stationCountFor(preset);

  // Centred sub-range the stations are spread across.
  const usableLo = DIAL_MIN + EDGE_MARGIN;
  const usableHi = DIAL_MAX - EDGE_MARGIN;
  const usableSpan = usableHi - usableLo;
  const span = usableSpan * clamp01(preset.spread);
  const lo = 500 - span / 2;
  const cell = span / count;

  const stations: StationDef[] = [];
  for (let i = 0; i < count; i++) {
    const cellCenter = lo + cell * (i + 0.5);
    // Jitter within the cell, but never so much that stations overlap.
    const jitter = cell * 0.3;
    const position = clamp(
      cellCenter + rand(-jitter, jitter),
      usableLo,
      usableHi,
    );
    const width = Math.max(
      24,
      preset.width * (1 + rand(-preset.widthJitter, preset.widthJitter)),
    );
    stations.push({
      id: `st-${i}`,
      position,
      basePosition: position,
      width,
      payload: payloadFor(preset, i),
      found: false,
      foundAtMs: null,
    });
  }

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
      stations.some((s) => Math.abs(s.position - pos) < minGap) ||
      decoys.some((d) => Math.abs(d.position - pos) < minGap);
    if (!tooClose) {
      decoys.push({ id: `decoy-${decoys.length}`, position: pos });
    }
  }
  return decoys;
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
    const target = rand(usableLo, usableHi);
    // Nudge it a meaningful distance from where it was, so a hop is noticeable.
    s.position =
      Math.abs(target - s.position) < 180
        ? clamp(s.position + (Math.random() < 0.5 ? -1 : 1) * rand(180, 320), usableLo, usableHi)
        : target;
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
