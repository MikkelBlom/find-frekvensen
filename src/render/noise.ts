// Pre-generated "snow" tiles for the radio static overlay.
//
// Generating random static every frame for up to 10 fields is wasteful, so we
// bake a handful of tiles once and cycle through them, modulating overall
// opacity by the (inverse) signal strength. More noise = weaker signal.

import { tokens } from "@/game/tokens";

const TILE_SIZE = 160;
const TILE_COUNT = 8;

let tiles: HTMLCanvasElement[] | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Lazily build (once) and return the set of noise tiles. */
export function getNoiseTiles(): HTMLCanvasElement[] {
  if (tiles) return tiles;
  const [tr, tg, tb] = hexToRgb(tokens.noiseTint);
  tiles = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const c = document.createElement("canvas");
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random();
      if (v > 0.7) {
        // bright speck
        const b = 0.5 + v * 0.5;
        data[i] = Math.min(255, tr * 0.45 + 255 * b * 0.55);
        data[i + 1] = Math.min(255, tg * 0.45 + 255 * b * 0.55);
        data[i + 2] = Math.min(255, tb * 0.45 + 255 * b * 0.55);
        data[i + 3] = Math.floor(120 + v * 90);
      } else if (v < 0.12) {
        // faint dark grain, keeps it from looking uniform
        data[i] = data[i + 1] = data[i + 2] = 0;
        data[i + 3] = 40;
      } else {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
}

export { TILE_COUNT };
