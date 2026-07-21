"use client";

import { useStore } from "@/game/store";
import { getAudio } from "@/audio/sound";
import { getSerialManager } from "@/serial/webserial";
import { tokens } from "@/game/tokens";

export function TopBar() {
  const preset = useStore((s) => s.config.preset);
  const soundEnabled = useStore((s) => s.config.soundEnabled);
  const deviceCount = useStore((s) => Object.keys(s.devices).length);
  const simEnabled = useStore((s) => s.sim.enabled);
  const serial = useStore((s) => s.serial);
  const toggleSound = useStore((s) => s.toggleSound);
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
        padding: "clamp(6px, 0.9vw, 16px) clamp(10px, 1.5vw, 26px)",
        borderBottom: `1px solid ${tokens.panelBorder}`,
        gap: "12px",
      }}
    >
      <div className="flex items-baseline" style={{ gap: "12px", minWidth: 0 }}>
        <span className="font-black" style={{ fontSize: "clamp(18px, 2.1vw, 34px)", color: tokens.headerText }}>
          📡 Find Frekvensen
        </span>
        <span className="truncate" style={{ fontSize: "clamp(11px, 1.1vw, 16px)", color: tokens.headerMuted }}>
          Hedy Lamarr · Ada Lovelace Dag
        </span>
      </div>

      <div className="flex items-center" style={{ gap: "clamp(6px, 0.8vw, 14px)" }}>
        <Chip label={preset.label} color={preset.accent} filled />
        <Chip label={`👤 ${deviceCount}`} color={tokens.info} />
        {simEnabled && <Chip label="SIM" color={tokens.warn} />}

        <SerialStatus
          supported={serial.supported}
          connected={serial.connected}
          onConnect={() => void getSerialManager().connect()}
          onDisconnect={() => void getSerialManager().disconnect()}
        />

        <IconButton title={soundEnabled ? "Slå lyd fra" : "Slå lyd til"} onClick={onToggleSound}>
          {soundEnabled ? "🔊" : "🔇"}
        </IconButton>
        <IconButton title="Debug (d)" onClick={toggleDebug}>
          ⚙️
        </IconButton>
      </div>
    </header>
  );
}

function Chip({ label, color, filled }: { label: string; color: string; filled?: boolean }) {
  return (
    <span
      className="font-bold whitespace-nowrap"
      style={{
        fontSize: "clamp(11px, 1.1vw, 16px)",
        padding: "4px 12px",
        borderRadius: "999px",
        color: filled ? "#10151c" : color,
        background: filled ? color : "transparent",
        border: `1.5px solid ${color}`,
      }}
    >
      {label}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center"
      style={{
        fontSize: "clamp(14px, 1.4vw, 20px)",
        width: "clamp(30px, 3vw, 42px)",
        height: "clamp(30px, 3vw, 42px)",
        borderRadius: "10px",
        background: "#0d141d",
        border: `1px solid ${tokens.panelBorder}`,
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
  onConnect,
  onDisconnect,
}: {
  supported: boolean;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!supported) {
    return <Chip label="Ingen Web Serial" color={tokens.bad} />;
  }
  if (connected) {
    return (
      <button
        onClick={onDisconnect}
        title="Afbryd base-station"
        className="font-bold whitespace-nowrap flex items-center"
        style={{
          fontSize: "clamp(11px, 1.1vw, 16px)",
          padding: "4px 12px",
          borderRadius: "999px",
          color: tokens.good,
          background: "transparent",
          border: `1.5px solid ${tokens.good}`,
          gap: "6px",
          cursor: "pointer",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tokens.good, display: "inline-block" }} />
        Forbundet
      </button>
    );
  }
  return (
    <button
      onClick={onConnect}
      className="font-bold whitespace-nowrap"
      style={{
        fontSize: "clamp(11px, 1.1vw, 16px)",
        padding: "4px 14px",
        borderRadius: "999px",
        color: "#10151c",
        background: tokens.info,
        border: `1.5px solid ${tokens.info}`,
        cursor: "pointer",
      }}
    >
      Forbind base-station
    </button>
  );
}
