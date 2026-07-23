"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/game/store";
import { getEngine } from "@/game/engine";
import { fieldTheme } from "@/game/themes";
import { accentFor, levelColor } from "@/game/palette";
import { usePalette } from "@/lib/usePalette";
import { useElementSize } from "@/lib/useElementSize";
import { MessageTray } from "./MessageTray";
import { PictureReveal } from "./PictureReveal";

export function RadioField({ index }: { index: number }) {
  const palette = usePalette();
  const snap = useStore((s) => s.snapshots[index]);
  const themeId = useStore((s) => s.config.themeId);
  const debugVisible = useStore((s) => s.debug.visible);
  const activeField = useStore((s) => s.debug.activeField);

  const theme = fieldTheme(themeId, index);
  const accent = accentFor(palette, index);
  const { ref: areaRef, size } = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const engine = getEngine();
    engine.attachCanvas(index, canvasRef.current);
    return () => engine.attachCanvas(index, null);
  }, [index]);

  useEffect(() => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    getEngine().updateMetrics(index, size.width, size.height, dpr);
  }, [index, size.width, size.height]);

  const phase = snap?.phase ?? "waiting";
  const items = snap?.revealed ?? [];
  const messageMode = snap?.messageMode ?? "word";
  const pictureId = snap?.pictureId ?? "radio";
  const foundCount = snap?.foundCount ?? 0;
  const total = snap?.totalStations ?? 0;
  const levelId = snap?.levelId ?? "green";
  const levelLabel = snap?.levelLabel ?? "Grøn";
  const lvlColor = levelColor(palette, levelId);
  const foundTiles = new Set(items.filter((i) => i.foundAtMs != null).map((i) => Number(i.payload)));
  const completeWord = items.map((i) => i.payload).join("");
  const active = phase !== "waiting";
  const isActive = debugVisible && activeField === index;

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        containerType: "size",
        height: "100%",
        borderRadius: "1.6cqmin",
        padding: "1.6cqmin",
        background: palette.cardBg,
        border: `0.4cqmin solid ${isActive ? accent : palette.cardBorder}`,
        boxShadow: isActive ? `0 0 0 0.3cqmin ${withAlpha(accent, 0.5)}` : "none",
        opacity: active ? 1 : 0.96,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ paddingBottom: "1.2cqmin", gap: "1.5cqmin" }}>
        <div className="flex items-center" style={{ gap: "1.6cqmin", minWidth: 0 }}>
          <Identity icon={theme.icon} index={index} accent={accent} textColor={palette.textOnGlass} />
          <span
            className="truncate"
            style={{ fontSize: "5.6cqmin", fontWeight: 800, color: palette.title, letterSpacing: "-0.01em" }}
          >
            {theme.name}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: "1.4cqmin" }}>
          {active && (
            <span
              style={{
                fontSize: "3.6cqmin",
                fontWeight: 800,
                padding: "0.5cqmin 1.8cqmin",
                borderRadius: "999px",
                color: lvlColor,
                background: withAlpha(lvlColor, palette.mode === "light" ? 0.14 : 0.2),
                border: `0.4cqmin solid ${withAlpha(lvlColor, 0.45)}`,
                whiteSpace: "nowrap",
              }}
            >
              {levelLabel}
            </span>
          )}
          {active && total > 0 && (
            <span
              style={{
                fontSize: "4cqmin",
                fontWeight: 800,
                color: foundCount === total ? palette.good : palette.textMuted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {foundCount}/{total}
            </span>
          )}
          <button
            onClick={() => getEngine().resetPanelToStart(index)}
            title="Nulstil dette felt"
            aria-label="Nulstil dette felt"
            className="flex items-center justify-center"
            style={{
              width: "7cqmin",
              height: "7cqmin",
              borderRadius: "1cqmin",
              background: "transparent",
              border: `0.4cqmin solid ${palette.cardBorder}`,
              color: palette.textMuted,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      {/* Dial */}
      <div ref={areaRef} className="relative flex-1" style={{ minHeight: 0 }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase === "waiting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ gap: "1.5cqmin" }}>
            <div className="idle-pulse" style={{ color: palette.textMuted }}>
              <TuneHint />
            </div>
            <span className="idle-pulse" style={{ fontSize: "4.4cqmin", fontWeight: 700, color: palette.textMuted }}>
              Vip micro:bit&apos;en for at tune ind
            </span>
          </div>
        )}

        {phase === "complete" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: "none" }}>
            <div
              className="complete-pop flex flex-col items-center justify-center text-center"
              style={{
                background: palette.completeScrim,
                borderRadius: "2.4cqmin",
                border: `0.5cqmin solid ${accent}`,
                padding: "2.6cqmin 3.6cqmin",
                maxWidth: "94%",
              }}
            >
              <span style={{ fontSize: "4cqmin", fontWeight: 800, letterSpacing: "0.14em", color: palette.good }}>
                FÆRDIG
              </span>
              {messageMode === "word" ? (
                <span
                  style={{
                    fontSize: "13cqmin",
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    color: palette.completeWord,
                    lineHeight: 1.05,
                  }}
                >
                  {completeWord}
                </span>
              ) : (
                <div style={{ marginTop: "1.4cqmin" }}>
                  <PictureReveal pictureId={pictureId} foundTiles={foundTiles} maxSize="44cqmin" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tray */}
      {total > 0 && phase !== "complete" && (
        <div className="flex items-center justify-center" style={{ paddingTop: "1.4cqmin", minHeight: 0 }}>
          {messageMode === "word" ? (
            <MessageTray items={items} accent={accent} />
          ) : (
            <PictureReveal pictureId={pictureId} foundTiles={foundTiles} maxSize="min(30cqmin, 92cqw)" />
          )}
        </div>
      )}
    </div>
  );
}

// Numbered badge for the "numbers" theme; emoji for the others.
function Identity({ icon, index, accent, textColor }: { icon: string; index: number; accent: string; textColor: string }) {
  if (icon) return <span style={{ fontSize: "7cqmin", lineHeight: 1 }}>{icon}</span>;
  return (
    <span
      className="flex items-center justify-center"
      style={{
        width: "8cqmin",
        height: "8cqmin",
        borderRadius: "999px",
        background: accent,
        color: contrastText(accent, textColor),
        fontSize: "4.6cqmin",
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      {index + 1}
    </span>
  );
}

function ResetIcon() {
  return (
    <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

function TuneHint() {
  const s = "16cqmin";
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="14" width="36" height="24" rx="4" />
      <line x1="12" y1="20" x2="30" y2="20" />
      <circle cx="35" cy="27" r="4" />
      <path d="M14 6l6 8M30 6l-4 8" />
    </svg>
  );
}

function withAlpha(color: string, alpha: number): string {
  const h = color.replace("#", "");
  if (h.length !== 6) return color;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Pick readable text (dark ink or the glass text) over an accent chip.
function contrastText(hex: string, fallback: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return fallback;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#2c2016" : "#fff";
}
