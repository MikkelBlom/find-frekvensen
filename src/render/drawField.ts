// Canvas renderer for a single vintage radio field. Draws (bottom to top):
//   cabinet + illuminated dial + frequency scale  (static — cached by engine)
//   station glow zones, grain/static, signal meter, needle, lock ring, markers.
//
// All colours come from the active Palette (light default, dark opt-in). All
// drawing is in CSS pixels; the engine applies the devicePixelRatio scale so
// this code is resolution-independent (1080p ↔ 4K).

import { tokens } from "@/game/tokens";
import type { Palette } from "@/game/palette";
import type { DifficultyPreset, PanelPhase, StationDef } from "@/game/types";
import { getNoiseTiles, TILE_COUNT } from "./noise";

export interface FieldDrawState {
  phase: PanelPhase;
  needlePos: number; // 0..1000
  warmth: number; // real, toward nearest unfound station
  displayWarmth: number; // felt bar level — only full when capturable
  lockable: boolean; // needle inside a real station window (can capture)
  directionHint: number; // -1 left / +1 right / 0 — which way the station is
  lockProgress: number; // 0..1
  lockingStationId: string | null;
  stations: StationDef[];
  nowMs: number;
  completeAtMs: number | null;
  accent: string;
  preset: DifficultyPreset;
  palette: Palette;
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
// Static faceplate — built once per size+theme into an offscreen canvas.
// ---------------------------------------------------------------------------
export function drawFaceplate(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  pal: Palette,
): void {
  const g = fieldGeometry(cssW, cssH);
  ctx.clearRect(0, 0, cssW, cssH);

  // Cabinet (wood bezel).
  const bezelGrad = ctx.createLinearGradient(0, g.face.y, 0, g.face.y + g.face.h);
  bezelGrad.addColorStop(0, pal.faceTop);
  bezelGrad.addColorStop(1, pal.faceBottom);
  roundRect(ctx, g.face.x, g.face.y, g.face.w, g.face.h, Math.min(cssW, cssH) * 0.04);
  ctx.fillStyle = bezelGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.min(cssW, cssH) * 0.005);
  ctx.strokeStyle = pal.faceEdge;
  ctx.stroke();

  // Illuminated dial.
  const glassGrad = ctx.createLinearGradient(0, g.glass.y, 0, g.glass.y + g.glass.h);
  glassGrad.addColorStop(0, pal.faceGlassTop);
  glassGrad.addColorStop(1, pal.faceGlassBottom);
  roundRect(ctx, g.glass.x, g.glass.y, g.glass.w, g.glass.h, Math.min(cssW, cssH) * 0.022);
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Scale ticks.
  const scaleY = g.band.y;
  for (let p = 0; p <= 1000; p += tokens.size.tickMinorEvery) {
    const x = posToX(p, g.band);
    const major = p % tokens.size.tickMajorEvery === 0;
    ctx.beginPath();
    ctx.strokeStyle = major ? pal.scaleTickMajor : pal.scaleTickMinor;
    ctx.lineWidth = major ? Math.max(1.5, g.band.h * 0.018) : Math.max(1, g.band.h * 0.009);
    const len = major ? g.band.h * 0.22 : g.band.h * 0.12;
    ctx.moveTo(x, scaleY);
    ctx.lineTo(x, scaleY + len);
    ctx.stroke();
  }

  // Faux-FM numerals at quarter points.
  ctx.fillStyle = pal.scaleNumber;
  ctx.font = `600 ${Math.round(g.band.h * 0.2)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const p of [0, 250, 500, 750, 1000]) {
    const freq = (88 + (p / 1000) * 20).toFixed(1);
    ctx.fillText(freq, posToX(p, g.band), scaleY + g.band.h * 0.26);
  }

  // Baseline under the scale.
  ctx.strokeStyle = pal.scaleLine;
  ctx.lineWidth = Math.max(1, g.band.h * 0.018);
  ctx.beginPath();
  ctx.moveTo(g.band.x, scaleY);
  ctx.lineTo(g.band.x + g.band.w, scaleY);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Dynamic layers.
// ---------------------------------------------------------------------------
export function drawField(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  bg: HTMLCanvasElement | null,
  s: FieldDrawState,
): void {
  const g = fieldGeometry(cssW, cssH);
  const pal = s.palette;

  if (bg) ctx.drawImage(bg, 0, 0, cssW, cssH);
  else drawFaceplate(ctx, cssW, cssH, pal);

  ctx.save();
  roundRect(ctx, g.glass.x, g.glass.y, g.glass.w, g.glass.h, Math.min(cssW, cssH) * 0.022);
  ctx.clip();

  const waiting = s.phase === "waiting";
  const complete = s.phase === "complete";
  const needleX = posToX(s.needlePos, g.band);
  const bandMid = g.band.y + g.band.h * 0.5;
  const felt = complete ? 1 : s.displayWarmth;
  const onStation = s.lockable && !complete;

  // 1) Base grain — cold across the band. Only the needle's spot clears, and it
  //    only goes fully SHARP when the signal is actually capturable. This is the
  //    fix for "the bar looked full but nothing happened": clear ≠ done, only
  //    the crisp on-station state (green glow + ring + LÅS) means "hold now".
  const coldNoise = waiting ? 0.12 : complete ? 0.03 : 0.6;
  drawNoise(ctx, g.band, s.nowMs, coldNoise, pal);

  if (!waiting && !complete) {
    const clearStrength = s.lockable ? 1 : Math.min(s.warmth, 0.5);
    if (clearStrength > 0.04) {
      const halfW = g.band.h * (0.4 + (s.lockable ? 1 : s.warmth) * 0.9);
      const grad = ctx.createLinearGradient(needleX - halfW, 0, needleX + halfW, 0);
      grad.addColorStop(0, withAlpha(pal.faceGlassBottom, 0));
      grad.addColorStop(0.5, withAlpha(pal.faceGlassBottom, clearStrength));
      grad.addColorStop(1, withAlpha(pal.faceGlassBottom, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(g.band.x, g.band.y - g.band.h * 0.06, g.band.w, g.band.h * 1.12);
    }
  }

  // 2) Found-station markers (tuning only; the card owns the complete state).
  if (!complete) {
    for (const st of s.stations) if (st.found) drawFoundMarker(ctx, g, st, pal);
  }

  // 3) Glow around the needle — warm amber while hunting, bright GREEN and
  //    pulsing when you're on a capturable signal.
  if (!waiting && (felt > 0.03 || onStation)) {
    const pulse = onStation ? 0.82 + 0.18 * Math.sin(s.nowMs / 130) : 1;
    const col = complete ? pal.warmMid : onStation ? pal.good : warmthColor(pal, s.warmth);
    const cx = complete ? g.band.x + g.band.w * 0.5 : needleX;
    const radius = complete ? g.band.w * 0.42 : g.band.h * (onStation ? 0.95 : 0.32 + s.warmth * 0.5);
    const baseAlpha = complete ? 0.26 : onStation ? 0.5 : (pal.mode === "light" ? 0.36 : 0.3) * felt;
    const grad = ctx.createRadialGradient(cx, bandMid, 0, cx, bandMid, radius);
    grad.addColorStop(0, withAlpha(col, baseAlpha * pulse));
    grad.addColorStop(1, withAlpha(col, 0));
    ctx.save();
    if (pal.mode === "dark") ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.fillRect(g.glass.x, g.glass.y, g.glass.w, g.glass.h);
    ctx.restore();
  }

  // 4) Signal meter — tops out and turns green only when capturable.
  if (!waiting) drawMeter(ctx, g.meter, felt, s.lockable, pal);

  // 5) Needle, direction hint, capture ring.
  if (!waiting && !complete) {
    if (s.directionHint !== 0) {
      drawDirectionArrow(
        ctx,
        needleX,
        g.band.y - g.band.h * 0.16,
        s.directionHint,
        g.band.h * 0.28,
        warmthColor(pal, s.warmth),
        s.nowMs,
      );
    }
    drawNeedle(ctx, g, needleX, pal);
    if (onStation || (s.lockingStationId && s.lockProgress > 0.01)) {
      drawLockRing(ctx, needleX, g.band.y + g.band.h * 0.16, g.band.h * 0.2, s.lockProgress, onStation, pal);
    }
    for (const st of s.stations) {
      if (st.found && st.foundAtMs != null) {
        const age = s.nowMs - st.foundAtMs;
        if (age >= 0 && age < tokens.timing.lockFlashMs) {
          drawFlash(ctx, posToX(st.position, g.band), bandMid, g.band.h, age / tokens.timing.lockFlashMs, pal);
        }
      }
    }
  }

  ctx.restore(); // unclip

  if (pal.mode === "dark") drawVignette(ctx, g.glass, cssW, cssH);
}

function drawNeedle(ctx: CanvasRenderingContext2D, g: Geom, x: number, pal: Palette): void {
  const top = g.band.y - g.band.h * 0.06;
  const bottom = g.band.y + g.band.h;
  const lw = Math.max(2, g.band.w * tokens.size.needleWidthFrac);

  ctx.save();
  ctx.shadowColor = withAlpha(pal.needle, pal.mode === "light" ? 0.25 : 0.5);
  ctx.shadowBlur = lw * (pal.mode === "light" ? 1.4 : 2.4);
  ctx.strokeStyle = pal.needle;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = pal.needleKnob;
  ctx.beginPath();
  ctx.moveTo(x - lw * 2.2, top);
  ctx.lineTo(x + lw * 2.2, top);
  ctx.lineTo(x, top + lw * 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMeter(
  ctx: CanvasRenderingContext2D,
  m: Rect,
  level: number,
  lockable: boolean,
  pal: Palette,
): void {
  const segments = 14;
  const gap = m.w * 0.008;
  const segW = (m.w - gap * (segments - 1)) / segments;
  const lit = Math.round(level * segments);
  for (let i = 0; i < segments; i++) {
    const x = m.x + i * (segW + gap);
    const frac = i / (segments - 1);
    // When capturable the whole lit bar turns green — an unmistakable "now".
    ctx.fillStyle = i < lit ? (lockable ? pal.good : warmthColor(pal, frac)) : pal.meterTrack;
    roundRect(ctx, x, m.y, segW, m.h, m.h * 0.2);
    ctx.fill();
  }
  ctx.fillStyle = lockable ? pal.good : pal.textMuted;
  ctx.font = `800 ${Math.round(m.h * 0.62)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(lockable ? "LÅS! HOLD" : "SIGNAL", m.x, m.y - m.h * 0.35);
}

// A pulsing chevron above the needle pointing the way to the nearest signal.
function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  size: number,
  color: string,
  nowMs: number,
): void {
  const t = 0.5 + 0.5 * Math.sin(nowMs / 200);
  const ax = x + dir * (size * 0.9 + t * size * 0.5);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * t;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir < 0) {
    ctx.moveTo(ax, y);
    ctx.lineTo(ax + size * 0.7, y - size * 0.5);
    ctx.lineTo(ax + size * 0.7, y + size * 0.5);
  } else {
    ctx.moveTo(ax, y);
    ctx.lineTo(ax - size * 0.7, y - size * 0.5);
    ctx.lineTo(ax - size * 0.7, y + size * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFoundMarker(ctx: CanvasRenderingContext2D, g: Geom, st: StationDef, pal: Palette): void {
  const x = posToX(st.position, g.band);
  const topY = g.band.y;
  ctx.save();
  ctx.strokeStyle = pal.found;
  ctx.shadowColor = withAlpha(pal.foundGlow, 0.6);
  ctx.shadowBlur = g.band.h * 0.16;
  ctx.lineWidth = Math.max(2, g.band.w * 0.006);
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, g.band.y + g.band.h * 0.9);
  ctx.stroke();

  ctx.fillStyle = pal.found;
  ctx.beginPath();
  ctx.arc(x, topY, Math.max(3, g.band.h * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLockRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  progress: number,
  onStation: boolean,
  pal: Palette,
): void {
  ctx.save();
  // Steady track ring — a clear bright-green "hold here" halo when on-station.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = onStation ? withAlpha(pal.good, 0.6) : withAlpha(pal.textMuted, 0.35);
  ctx.lineWidth = r * 0.26;
  ctx.stroke();

  // Progress arc fills in green as the child holds.
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = pal.good;
  ctx.lineWidth = r * 0.26;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

function drawFlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  base: number,
  t: number,
  pal: Palette,
): void {
  const r = base * (0.14 + t * 0.42);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = pal.found;
  ctx.lineWidth = base * 0.08 * (1 - t);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNoise(ctx: CanvasRenderingContext2D, band: Rect, nowMs: number, level: number, pal: Palette): void {
  if (level <= 0.01) return;
  const tiles = getNoiseTiles(pal);
  const idx = Math.floor(nowMs / 70) % TILE_COUNT;
  ctx.save();
  ctx.globalAlpha = level;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiles[idx], band.x, band.y - band.h * 0.06, band.w, band.h * 1.1);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, glass: Rect, cssW: number, cssH: number): void {
  const grad = ctx.createRadialGradient(
    glass.x + glass.w / 2,
    glass.y + glass.h / 2,
    Math.min(glass.w, glass.h) * 0.2,
    glass.x + glass.w / 2,
    glass.y + glass.h / 2,
    Math.max(glass.w, glass.h) * 0.7,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.save();
  roundRect(ctx, glass.x, glass.y, glass.w, glass.h, Math.min(glass.w, glass.h) * 0.06);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------
export function warmthColor(pal: Palette, w: number): string {
  const c = clamp(w, 0, 1);
  if (c < 0.5) return lerpHex(pal.warmCold, pal.warmMid, c / 0.5);
  return lerpHex(pal.warmMid, pal.warmHot, (c - 0.5) / 0.5);
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
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `,${clamp(alpha, 0, 1)})`);
  if (color.startsWith("rgba(")) return color;
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
