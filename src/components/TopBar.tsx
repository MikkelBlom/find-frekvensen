"use client";

import { useStore } from "@/game/store";
import { getAudio } from "@/audio/sound";
import { getSerialManager } from "@/serial/webserial";
import { getEngine } from "@/game/engine";
import { usePalette } from "@/lib/usePalette";
import { tokens } from "@/game/tokens";
import type { Palette } from "@/game/palette";

export function TopBar() {
  const palette = usePalette();
  const soundEnabled = useStore((s) => s.config.soundEnabled);
  const themeMode = useStore((s) => s.config.themeMode);
  // Live handhelds only: not ones that went quiet, and not a one-off phantom id
  // from a corrupted line. Re-evaluated on every store update (≥12/s).
  const deviceCount = useStore((s) => {
    const now = performance.now();
    return Object.values(s.devices).filter(
      (d) => d.packets >= tokens.timing.joinPackets && now - d.lastSeenMs <= tokens.timing.offlineMs,
    ).length;
  });
  const simEnabled = useStore((s) => s.sim.enabled);
  const serial = useStore((s) => s.serial);
  const toggleSound = useStore((s) => s.toggleSound);
  const toggleTheme = useStore((s) => s.toggleThemeMode);
  const toggleDebug = useStore((s) => s.toggleDebug);

  const onToggleSound = async () => {
    if (!soundEnabled) await getAudio().enable();
    else getAudio().disable();
    toggleSound();
  };

  return (
    <header
      className="flex items-center justify-between"
      style={{
        padding: "clamp(8px, 1vw, 16px) clamp(12px, 1.6vw, 28px)",
        borderBottom: `1px solid ${palette.cardBorder}`,
        gap: "12px",
      }}
    >
      <div className="flex items-center" style={{ gap: "12px", minWidth: 0 }}>
        <BroadcastMark color={palette.needle} />
        <div className="flex items-baseline" style={{ gap: "12px", minWidth: 0 }}>
          <span
            style={{
              fontSize: "clamp(18px, 2.1vw, 32px)",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: palette.title,
            }}
          >
            Find Frekvensen
          </span>
          <span
            className="truncate"
            style={{ fontSize: "clamp(11px, 1.05vw, 15px)", color: palette.subtitle }}
          >
            Hedy Lamarr · Ada Lovelace Dag
          </span>
        </div>
      </div>

      <div className="flex items-center" style={{ gap: "clamp(6px, 0.8vw, 12px)" }}>
        <Chip label={`${deviceCount} spiller${deviceCount === 1 ? "" : "e"}`} color={palette.info} palette={palette} />
        {simEnabled && <Chip label="SIM" color={palette.warn} palette={palette} />}

        <TextButton onClick={() => getEngine().resetAllToStart()} palette={palette}>
          Nulstil alle
        </TextButton>

        <SerialStatus
          supported={serial.supported}
          connected={serial.connected}
          palette={palette}
          onConnect={() => void getSerialManager().connect()}
          onDisconnect={() => void getSerialManager().disconnect()}
        />

        <IconButton title={soundEnabled ? "Slå lyd fra" : "Slå lyd til"} onClick={onToggleSound} palette={palette}>
          {soundEnabled ? <SpeakerOn /> : <SpeakerOff />}
        </IconButton>
        <IconButton
          title={themeMode === "dark" ? "Lyst tema" : "Mørkt tema"}
          onClick={toggleTheme}
          palette={palette}
        >
          {themeMode === "dark" ? <SunIcon /> : <MoonIcon />}
        </IconButton>
        <IconButton title="Indstillinger (d)" onClick={toggleDebug} palette={palette}>
          <SlidersIcon />
        </IconButton>
      </div>
    </header>
  );
}

// ---- pieces ----
function Chip({ label, color, palette }: { label: string; color: string; palette: Palette }) {
  return (
    <span
      style={{
        fontSize: "clamp(11px, 1.05vw, 15px)",
        fontWeight: 700,
        padding: "4px 12px",
        borderRadius: "999px",
        color,
        background: withAlpha(color, palette.mode === "light" ? 0.12 : 0.18),
        border: `1px solid ${withAlpha(color, 0.4)}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function TextButton({
  children,
  onClick,
  palette,
}: {
  children: React.ReactNode;
  onClick: () => void;
  palette: Palette;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: "clamp(11px, 1.05vw, 15px)",
        fontWeight: 700,
        padding: "5px 14px",
        borderRadius: "999px",
        color: palette.title,
        background: palette.cardBg,
        border: `1px solid ${palette.cardBorder}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  title,
  palette,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  palette: Palette;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex items-center justify-center"
      style={{
        width: "clamp(32px, 3vw, 42px)",
        height: "clamp(32px, 3vw, 42px)",
        borderRadius: "10px",
        background: palette.cardBg,
        border: `1px solid ${palette.cardBorder}`,
        color: palette.title,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SerialStatus({
  supported,
  connected,
  palette,
  onConnect,
  onDisconnect,
}: {
  supported: boolean;
  connected: boolean;
  palette: Palette;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!supported) return <Chip label="Ingen Web Serial" color={palette.bad} palette={palette} />;
  if (connected) {
    return (
      <button
        onClick={onDisconnect}
        title="Afbryd base-station"
        className="flex items-center"
        style={{
          fontSize: "clamp(11px, 1.05vw, 15px)",
          fontWeight: 700,
          padding: "5px 12px",
          borderRadius: "999px",
          color: palette.good,
          background: withAlpha(palette.good, palette.mode === "light" ? 0.12 : 0.18),
          border: `1px solid ${withAlpha(palette.good, 0.45)}`,
          gap: "7px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: palette.good, display: "inline-block" }} />
        Forbundet
      </button>
    );
  }
  return (
    <button
      onClick={onConnect}
      style={{
        fontSize: "clamp(11px, 1.05vw, 15px)",
        fontWeight: 700,
        padding: "5px 14px",
        borderRadius: "999px",
        color: palette.mode === "light" ? "#fff" : "#1a140c",
        background: palette.info,
        border: `1px solid ${palette.info}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      Forbind base-station
    </button>
  );
}

// ---- inline SVG marks (no emoji) ----
function BroadcastMark({ color }: { color: string }) {
  const s = "clamp(22px, 2.4vw, 34px)";
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="20" r="3" fill={color} />
      <path d="M10 20a6 6 0 0 1 12 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 20a9.5 9.5 0 0 1 19 0" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M3 20a13 13 0 0 1 26 0" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.32" />
    </svg>
  );
}
const ico = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function SunIcon() {
  return (
    <svg {...ico} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg {...ico} aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
function SpeakerOn() {
  return (
    <svg {...ico} aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
    </svg>
  );
}
function SpeakerOff() {
  return (
    <svg {...ico} aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9l4 6M21 9l-4 6" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg {...ico} aria-hidden>
      <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="7" cy="16" r="2" />
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
