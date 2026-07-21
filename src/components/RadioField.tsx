"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/game/store";
import { getEngine } from "@/game/engine";
import { fieldTheme } from "@/game/themes";
import { tokens } from "@/game/tokens";
import { useElementSize } from "@/lib/useElementSize";
import { MessageTray } from "./MessageTray";
import { PictureReveal } from "./PictureReveal";

export function RadioField({ index }: { index: number }) {
  const snap = useStore((s) => s.snapshots[index]);
  const themeId = useStore((s) => s.config.themeId);
  const debugVisible = useStore((s) => s.debug.visible);
  const activeField = useStore((s) => s.debug.activeField);

  const theme = fieldTheme(themeId, index);
  const { ref: areaRef, size } = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Register / unregister this field's canvas with the engine.
  useEffect(() => {
    const engine = getEngine();
    engine.attachCanvas(index, canvasRef.current);
    return () => engine.attachCanvas(index, null);
  }, [index]);

  // Keep the engine's metrics in sync with the rendered size + DPI.
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
  const foundTiles = new Set(
    items.filter((i) => i.foundAtMs != null).map((i) => Number(i.payload)),
  );
  const completeWord = items.map((i) => i.payload).join("");

  const isActive = debugVisible && activeField === index;

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        containerType: "size",
        height: "100%",
        borderRadius: "1.6cqmin",
        padding: "1.6cqmin",
        background: "#0d141d",
        border: `0.5cqmin solid ${isActive ? theme.accent : tokens.panelBorder}`,
        boxShadow: isActive ? `0 0 0 0.4cqmin ${theme.accent}66` : "none",
        opacity: phase === "waiting" ? 0.92 : 1,
      }}
    >
      {/* Header: identity + progress */}
      <div className="flex items-center justify-between" style={{ paddingBottom: "1.2cqmin" }}>
        <div className="flex items-center" style={{ gap: "1.6cqmin", minWidth: 0 }}>
          <span style={{ fontSize: "8cqmin", lineHeight: 1 }}>{theme.icon}</span>
          <span
            className="font-extrabold truncate"
            style={{ fontSize: "6cqmin", color: theme.accent, letterSpacing: "0.02em" }}
          >
            {theme.name}
          </span>
        </div>
        {total > 0 && (
          <span
            className="font-bold"
            style={{
              fontSize: "4.6cqmin",
              padding: "0.8cqmin 2cqmin",
              borderRadius: "999px",
              background: "#0a0f16",
              border: `0.4cqmin solid ${tokens.panelBorder}`,
              color: foundCount === total ? tokens.good : tokens.textMuted,
            }}
          >
            {foundCount}/{total}
          </span>
        )}
      </div>

      {/* Dial (canvas) + overlays */}
      <div ref={areaRef} className="relative flex-1" style={{ minHeight: 0 }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase === "waiting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="idle-pulse" style={{ fontSize: "16cqmin" }}>
              📻
            </span>
            <span
              className="idle-pulse font-bold"
              style={{ fontSize: "5cqmin", color: tokens.textMuted, marginTop: "1cqmin" }}
            >
              Vip din micro:bit
            </span>
            <span style={{ fontSize: "3.6cqmin", color: tokens.trayEmptyBorder }}>
              for at tænde radioen
            </span>
          </div>
        )}

        {phase === "complete" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: "none" }}>
            <div
              className="complete-pop flex flex-col items-center justify-center text-center"
              style={{
                background: tokens.completeBg,
                borderRadius: "3cqmin",
                border: `0.6cqmin solid ${theme.accent}`,
                padding: "3cqmin 4cqmin",
                maxWidth: "92%",
                backdropFilter: "blur(2px)",
              }}
            >
              <span className="font-black" style={{ fontSize: "5cqmin", color: tokens.good }}>
                ✓ FÆRDIG!
              </span>
              {messageMode === "word" ? (
                <span
                  className="font-black"
                  style={{
                    fontSize: "14cqmin",
                    letterSpacing: "0.08em",
                    color: tokens.stationFound,
                    lineHeight: 1.1,
                  }}
                >
                  {completeWord}
                </span>
              ) : (
                <div style={{ marginTop: "1.5cqmin" }}>
                  <PictureReveal pictureId={pictureId} foundTiles={foundTiles} maxSize="46cqmin" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collected message tray */}
      {total > 0 && phase !== "complete" && (
        <div className="flex items-center justify-center" style={{ paddingTop: "1.4cqmin", minHeight: 0 }}>
          {messageMode === "word" ? (
            <MessageTray items={items} accent={theme.accent} />
          ) : (
            <PictureReveal pictureId={pictureId} foundTiles={foundTiles} maxSize="min(30cqmin, 92cqw)" />
          )}
        </div>
      )}
    </div>
  );
}
