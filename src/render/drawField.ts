// Canvas renderer for a single retro radio field. Draws (bottom to top):
//   faceplate + glass + frequency scale  (static — cached by the engine)
//   station glow zones, snow/static, signal meter, needle, lock ring, markers.
//
// All drawing is in CSS pixels; the engine applies the devicePixelRatio scale
// on the context so this code is resolution-independent (1080p ↔ 4K).

import { tokens } from "@/game/tokens";
import type { DifficultyPreset, PanelPhase, StationDef } from "@/game/types";
import { getNoiseTiles, TILE_COUNT } from "./noise";

export interface FieldDrawState {
  phase: PanelPhase;
  needlePos: number; // 0..1000
  warmth: number; // real, toward nearest unfound station
  displayWarmth: number; // felt, includes decoys — drives snow + meter
  lockProgress: number; // 0..1
  lockingStationId: string | null;
  stations: StationDef[];
  nowMs: number;
  completeAtMs: number | null;
  accent: string;
  preset: DifficultyPreset;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Geom {
  face: Rect;
  glass: Rect;
  band: Rect;
  meter: Rect;
}

// ---------------------------------------------------------------------------
// Geometry — shared by the static faceplate and the dynamic layers so they line
// up exactly.
// ---------------------------------------------------------------------------
export function fieldGeometry(cssW: number, cssH: number): Geom {
  const outerMargin = Math.min(cssW, cssH) * 0.02;
  const bezel = Math.min(cssW, cssH) * tokens.size.faceInset;
  const face: Rect = {
    x: outerMargin,
    y: outerMargin,
    w: cssW - outerMargin * 2,
    h: cssH - outerMargin * 2,
  };
  const glass: Rect = {
    x: face.x + bezel,
    y: face.y + bezel,
    w: face.w - bezel * 2,
    h: face.h - bezel * 2,
  };
  const padX = glass.w * 0.06;
  const band: Rect = {
    x: glass.x + padX,
    y: glass.y + glass.h * tokens.size.scaleBandTop,
    w: glass.w - padX * 2,
    h: glass.h * tokens.size.scaleBandHeight,
  };
  const meter: Rect = {
    x: band.x,
    y: band.y + band.h + glass.h * 0.08,
    w: band.w,
    h: glass.h * tokens.size.meterHeightFrac,
  };
  return { face, glass, band, meter };
}

function posToX(pos: number, band: Rect): number {
  return band.x + (clamp(pos, 0, 1000) / 1000) * band.w;
}

// ---------------------------------------------------------------------------
// Static faceplate — built once per size into an offscreen canvas by the engine.
// ---------------------------------------------------------------------------
export function drawFaceplate(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
  const g = fieldGeometry(cssW, cssH);
  ctx.clearRect(0, 0, cssW, cssH);

  // Bezel (walnut) with rounded corners.
  const bezelGrad = ctx.createLinearGradient(0, g.face.y, 0, g.face.y + g.face.h);
  bezelGrad.addColorStop(0, tokens.faceTop);
  bezelGrad.addColorStop(1, tokens.faceBottom);
  roundRect(ctx, g.face.x, g.face.y, g.face.w, g.face.h, Math.min(cssW, cssH) * 0.04);
  ctx.fillStyle = bezelGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.min(cssW, cssH) * 0.006);
  ctx.strokeStyle = tokens.faceEdge;
  ctx.stroke();

  // Glass (the signal screen).
  const glassGrad = ctx.createLinearGradient(0, g.glass.y, 0, g.glass.y + g.glass.h);
  glassGrad.addColorStop(0, tokens.faceGlassTop);
  glassGrad.addColorStop(1, tokens.faceGlassBottom);
  roundRect(ctx, g.glass.x, g.glass.y, g.glass.w, g.glass.h, Math.min(cssW, cssH) * 0.025);
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Frequency scale ticks + numbers along the top of the band.
  const scaleY = g.band.y;
  ctx.strokeStyle = tokens.scaleTickMinor;
  ctx.lineWidth = Math.max(1, g.band.h * 0.012);
  for (let p = 0; p <= 1000; p += tokens.size.tickMinorEvery) {
    const x = posToX(p, g.band);
    const major = p % tokens.size.tickMajorEvery === 0;
    ctx.beginPath();
    ctx.strokeStyle = major ? tokens.scaleTickMajor : tokens.scaleTickMinor;
    ctx.lineWidth = major ? Math.max(1.5, g.band.h * 0.02) : Math.max(1, g.band.h * 0.01);
    const len = major ? g.band.h * 0.22 : g.band.h * 0.12;
    ctx.moveTo(x, scaleY);
    ctx.lineTo(x, scaleY + len);
    ctx.stroke();
  }

  // A few faux-FM labels (88.0–108.0) at quarter points — reads as a radio dial.
  ctx.fillStyle = tokens.scaleNumber;
  ctx.font = `600 ${Math.round(g.band.h * 0.2)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const p of [0, 250, 500, 750, 1000]) {
    const freq = (88 + (p / 1000) * 20).toFixed(1);
    ctx.fillText(freq, posToX(p, g.band), scaleY + g.band.h * 0.26);
  }

  // Baseline under the scale.
  ctx.strokeStyle = tokens.scaleLine;
  ctx.lineWidth = Math.max(1, g.band.h * 0.02);
  ctx.beginPath();
  ctx.moveTo(g.band.x, scaleY);
  ctx.lineTo(g.band.x + g.band.w, scaleY);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Dynamic layers — drawn every frame on top of the cached faceplate.
// ---------------------------------------------------------------------------
export function drawField(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  bg: HTMLCanvasElement | null,
  s: FieldDrawState,
): void {
  const g = fieldGeometry(cssW, cssH);

  // Faceplate (cached) or fall back to drawing it live.
  if (bg) ctx.drawImage(bg, 0, 0, cssW, cssH);
  else drawFaceplate(ctx, cssW, cssH);

  // Clip subsequent effects to the glass so glows never spill over the bezel.
  ctx.save();
  roundRect(ctx, g.glass.x, g.glass.y, g.glass.w, g.glass.h, Math.min(cssW, cssH) * 0.025);
  ctx.clip();

  const waiting = s.phase === "waiting";
  const complete = s.phase === "complete";
  const needleX = posToX(s.needlePos, g.band);
  const bandMid = g.band.y + g.band.h * 0.5;
  // "felt" signal drives noise/glow/meter (decoys count); a completed field
  // reads as a full, clear signal.
  const felt = complete ? 1 : s.displayWarmth;

  // 1) Snow / static across the band — heavier the weaker the signal. The whole
  //    field visibly de-snows as you home in on a station: the obvious
  //    "noise → clear signal" difference the design calls for.
  const noiseLevel = waiting ? 0.14 : complete ? 0.03 : clamp(1 - felt, 0.04, 0.72);
  drawNoise(ctx, g.band, s.nowMs, noiseLevel);

  // 2) A soft clear "sweet spot" right at the needle — a gentle vertical glow of
  //    glass that thins the static where you are tuned (no hard edges).
  if (!waiting && !complete && felt > 0.05) {
    const halfW = g.band.h * (0.35 + felt * 0.75);
    const grad = ctx.createLinearGradient(needleX - halfW, 0, needleX + halfW, 0);
    grad.addColorStop(0, hexWithAlpha(tokens.faceGlassBottom, 0));
    grad.addColorStop(0.5, hexWithAlpha(tokens.faceGlassBottom, 0.7 * felt));
    grad.addColorStop(1, hexWithAlpha(tokens.faceGlassBottom, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(g.band.x, g.band.y - g.band.h * 0.06, g.band.w, g.band.h * 1.12);
  }

  // 3) Found-station markers on the dial (tuning only; the card owns complete).
  if (!complete) {
    for (const st of s.stations) {
      if (st.found) drawFoundMarker(ctx, g, st);
    }
  }

  // 4) Colour warmth halo — a restrained glow around the needle, not a wash.
  if (!waiting && felt > 0.03) {
    const col = complete ? tokens.warmMid : warmthColor(felt);
    const cx = complete ? g.band.x + g.band.w * 0.5 : needleX;
    const radius = complete ? g.band.w * 0.42 : g.band.h * (0.32 + felt * 0.55);
    const alpha = complete ? 0.26 : 0.34 * felt;
    const grad = ctx.createRadialGradient(cx, bandMid, 0, cx, bandMid, radius);
    grad.addColorStop(0, hexWithAlpha(col, alpha));
    grad.addColorStop(1, hexWithAlpha(col, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.fillRect(g.glass.x, g.glass.y, g.glass.w, g.glass.h);
    ctx.restore();
  }

  // 5) Signal-strength meter.
  drawMeter(ctx, g.meter, waiting ? 0 : felt, s.accent);

  // 6) Needle + lock ring (tuning only).
  if (!waiting && !complete) {
    drawNeedle(ctx, g, needleX);
    if (s.lockingStationId && s.lockProgress > 0.01) {
      drawLockRing(ctx, needleX, g.band.y + g.band.h * 0.16, g.band.h * 0.19, s.lockProgress);
    }
    // Lock flash burst just after a station is found.
    for (const st of s.stations) {
      if (st.found && st.foundAtMs != null) {
        const age = s.nowMs - st.foundAtMs;
        if (age >= 0 && age < tokens.timing.lockFlashMs) {
          drawFlash(ctx, posToX(st.position, g.band), bandMid, g.band.h, age / tokens.timing.lockFlashMs);
        }
      }
    }
  }

  ctx.restore(); // unclip

  // Subtle screen vignette for retro depth.
  drawVignette(ctx, g.glass);
}

function drawNeedle(ctx: CanvasRenderingContext2D, g: Geom, x: number): void {
  const top = g.band.y - g.band.h * 0.06;
  const bottom = g.band.y + g.band.h;
  const lw = Math.max(2, g.band.w * tokens.size.needleWidthFrac);

  ctx.save();
  ctx.shadowColor = tokens.needleGlow;
  ctx.shadowBlur = lw * 3;
  ctx.strokeStyle = tokens.needle;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();

  // Pointer knob at the top.
  ctx.fillStyle = tokens.needleKnob;
  ctx.beginPath();
  ctx.moveTo(x - lw * 2.2, top);
  ctx.lineTo(x + lw * 2.2, top);
  ctx.lineTo(x, top + lw * 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMeter(ctx: CanvasRenderingContext2D, m: Rect, level: number, accent: string): void {
  const segments = 14;
  const gap = m.w * 0.008;
  const segW = (m.w - gap * (segments - 1)) / segments;
  const lit = Math.round(level * segments);
  for (let i = 0; i < segments; i++) {
    const x = m.x + i * (segW + gap);
    const frac = i / (segments - 1);
    const on = i < lit;
    ctx.fillStyle = on ? warmthColor(frac) : "rgba(255,255,255,0.06)";
    roundRect(ctx, x, m.y, segW, m.h, m.h * 0.2);
    ctx.fill();
  }
  // "SIGNAL" label.
  ctx.fillStyle = tokens.textMuted;
  ctx.font = `700 ${Math.round(m.h * 0.62)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("SIGNAL", m.x, m.y - m.h * 0.35);
  // colour hint uses accent when nearly full
  if (level > 0.9) {
    ctx.fillStyle = accent;
    ctx.textAlign = "right";
    ctx.fillText("★", m.x + m.w, m.y - m.h * 0.35);
  }
}

function drawFoundMarker(ctx: CanvasRenderingContext2D, g: Geom, st: StationDef): void {
  // A subtle gold "locked" tick on the dial + a dot at the baseline. The actual
  // letters/tiles are shown in the DOM tray, so this stays uncluttered.
  const x = posToX(st.position, g.band);
  const topY = g.band.y;
  ctx.save();
  ctx.strokeStyle = tokens.stationFound;
  ctx.shadowColor = tokens.stationFoundGlow;
  ctx.shadowBlur = g.band.h * 0.2;
  ctx.lineWidth = Math.max(2, g.band.w * 0.006);
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, g.band.y + g.band.h * 0.9);
  ctx.stroke();

  ctx.fillStyle = tokens.stationFound;
  ctx.beginPath();
  ctx.arc(x, topY, Math.max(3, g.band.h * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLockRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number): void {
  ctx.save();
  // track
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = r * 0.28;
  ctx.stroke();
  // progress
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = tokens.warmLock;
  ctx.shadowColor = tokens.needleGlow;
  ctx.shadowBlur = r * 0.6;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

function drawFlash(ctx: CanvasRenderingContext2D, x: number, y: number, base: number, t: number): void {
  // A compact burst around the freshly-locked station (not a screen-filling ring).
  const r = base * (0.14 + t * 0.42);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = tokens.stationFoundGlow;
  ctx.lineWidth = base * 0.09 * (1 - t);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNoise(ctx: CanvasRenderingContext2D, band: Rect, nowMs: number, level: number): void {
  if (level <= 0.01) return;
  const tiles = getNoiseTiles();
  const idx = Math.floor(nowMs / 70) % TILE_COUNT;
  ctx.save();
  ctx.globalAlpha = level;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiles[idx], band.x, band.y - band.h * 0.06, band.w, band.h * 1.1);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, glass: Rect): void {
  const grad = ctx.createRadialGradient(
    glass.x + glass.w / 2,
    glass.y + glass.h / 2,
    Math.min(glass.w, glass.h) * 0.2,
    glass.x + glass.w / 2,
    glass.y + glass.h / 2,
    Math.max(glass.w, glass.h) * 0.7,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.save();
  roundRect(ctx, glass.x, glass.y, glass.w, glass.h, Math.min(glass.w, glass.h) * 0.06);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(glass.x, glass.y, glass.w, glass.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Colour + shape helpers.
// ---------------------------------------------------------------------------
export function warmthColor(w: number): string {
  const c = clamp(w, 0, 1);
  if (c < 0.5) return lerpHex(tokens.warmCold, tokens.warmMid, c / 0.5);
  return lerpHex(tokens.warmMid, tokens.warmHot, (c - 0.5) / 0.5);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `,${clamp(alpha, 0, 1)})`);
  }
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
