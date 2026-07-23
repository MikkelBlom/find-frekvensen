// Pre-generated grain/"snow" tiles for the weak-signal overlay, themed by the
// active palette: dark grain on a light dial, light grain on a dark dial.
//
// Generating random grain every frame for up to 10 fields is wasteful, so we
// bake a handful of tiles once per palette and cycle through them, modulating
// opacity by the (inverse) signal strength.

import type { Palette } from "@/game/palette";

const TILE_SIZE = 160;
const TILE_COUNT = 8;

const cache = new Map<string, HTMLCanvasElement[]>();

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Lazily build (once per theme) and return the set of grain tiles. */
export function getNoiseTiles(palette: Palette): HTMLCanvasElement[] {
  const key = `${palette.noise}-${palette.noiseDark}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const [nr, ng, nb] = hexToRgb(palette.noise);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const c = document.createElement("canvas");
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random();
      if (v > 0.68) {
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
        data[i + 3] = Math.floor(90 + v * 110);
      } else if (v < 0.14) {
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
        data[i + 3] = 30;
      } else {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  cache.set(key, tiles);
  return tiles;
}

export { TILE_COUNT };
