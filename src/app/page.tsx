"use client";

import { useStore } from "@/game/store";
import { useAppRuntime } from "@/lib/useAppRuntime";
import { usePalette } from "@/lib/usePalette";
import { TopBar } from "@/components/TopBar";
import { FieldGrid } from "@/components/FieldGrid";
import { DebugPanel } from "@/components/DebugPanel";

export default function Home() {
  useAppRuntime();
  const palette = usePalette();
  const showFps = useStore((s) => s.debug.showFps);
  const fps = useStore((s) => s.debug.fps);
  const latency = useStore((s) => s.debug.renderLatencyMs);

  return (
    <div
      className="tv-root"
      style={{
        background: `radial-gradient(1400px 900px at 50% -8%, ${palette.pageBg}, ${palette.pageBgEdge})`,
        color: palette.title,
      }}
    >
      <TopBar />
      <FieldGrid />
      <DebugPanel />

      {showFps && (
        <div
          style={{
            position: "fixed",
            left: 8,
            bottom: 8,
            zIndex: 40,
            padding: "4px 10px",
            borderRadius: 8,
            background: palette.cardBg,
            border: `1px solid ${palette.cardBorder}`,
            fontSize: 12,
            color: palette.textMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fps} FPS · {latency}ms/frame
        </div>
      )}
    </div>
  );
}
