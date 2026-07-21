"use client";

import { useStore } from "@/game/store";
import { useAppRuntime } from "@/lib/useAppRuntime";
import { TopBar } from "@/components/TopBar";
import { FieldGrid } from "@/components/FieldGrid";
import { DebugPanel } from "@/components/DebugPanel";
import { tokens } from "@/game/tokens";

export default function Home() {
  useAppRuntime();
  const showFps = useStore((s) => s.debug.showFps);
  const fps = useStore((s) => s.debug.fps);
  const latency = useStore((s) => s.debug.renderLatencyMs);

  return (
    <div className="tv-root">
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
            background: "rgba(8,12,18,0.85)",
            border: `1px solid ${tokens.panelBorder}`,
            fontSize: 12,
            color: tokens.headerMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fps} FPS · {latency}ms/frame
        </div>
      )}
    </div>
  );
}
