"use client";

import { useStore } from "@/game/store";
import { getSimulator, type SimMode } from "@/sim/simulator";
import { getSerialManager } from "@/serial/webserial";
import { getEngine } from "@/game/engine";
import { THEMES } from "@/game/themes";
import { PICTURES } from "@/game/pictures";
import { PRESETS, FIELD_COUNT_MIN, FIELD_COUNT_MAX } from "@/game/presets";
import { tokens } from "@/game/tokens";
import type { PanelSnapshot } from "@/game/types";

const SIM_MODES: SimMode[] = ["sweep", "solve", "manual", "idle"];

export function DebugPanel() {
  const visible = useStore((s) => s.debug.visible);
  if (!visible) return null;
  return <DebugPanelBody />;
}

function DebugPanelBody() {
  const config = useStore((s) => s.config);
  const devices = useStore((s) => s.devices);
  const snapshots = useStore((s) => s.snapshots);
  const serial = useStore((s) => s.serial);
  const sim = useStore((s) => s.sim);
  const debug = useStore((s) => s.debug);

  const st = useStore.getState();
  const engine = getEngine();
  const simulator = getSimulator();
  const serialMgr = getSerialManager();
  // Engine-stamped clock (updated while the panel is open) for fresh ages.
  const now = debug.clockMs;

  const snapBySerial = new Map<string, PanelSnapshot>();
  snapshots.forEach((s) => {
    if (s.serial) snapBySerial.set(s.serial, s);
  });

  // Any change that alters the field layout regenerates active games.
  const resetGames = () => engine.resetAll();

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: "min(400px, 92vw)",
        background: "rgba(8, 12, 18, 0.97)",
        borderLeft: `1px solid ${tokens.panelBorder}`,
        overflowY: "auto",
        zIndex: 50,
        padding: "14px",
        fontSize: "13px",
        color: "#e8eef5",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>🛠️ Debug</strong>
        <button style={btn} onClick={() => st.toggleDebug()}>
          Luk (d)
        </button>
      </div>

      {/* ---- Game / god mode ---- */}
      <Section title="Spil">
        <Label>Sværhedsgrad</Label>
        <div className="flex" style={{ gap: 6, marginBottom: 8 }}>
          {Object.values(PRESETS).map((p) => (
            <button
              key={p.id}
              style={{ ...btn, flex: 1, borderColor: p.accent, background: config.preset.id === p.id ? p.accent : "transparent", color: config.preset.id === p.id ? "#10151c" : p.accent }}
              onClick={() => {
                st.setPreset(p.id);
                resetGames();
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Label>Antal felter: {config.fieldCount}</Label>
        <input
          type="range"
          min={FIELD_COUNT_MIN}
          max={FIELD_COUNT_MAX}
          value={config.fieldCount}
          onChange={(e) => st.setFieldCount(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 8 }}
        />

        <Label>Tema</Label>
        <select value={config.themeId} onChange={(e) => st.setThemeId(e.target.value)} style={input}>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <Label>Besked-type</Label>
        <div className="flex" style={{ gap: 6, marginBottom: 8 }}>
          {(["word", "image"] as const).map((m) => (
            <button
              key={m}
              style={{ ...btn, flex: 1, background: config.preset.messageMode === m ? tokens.info : "transparent", color: config.preset.messageMode === m ? "#10151c" : tokens.info }}
              onClick={() => {
                st.patchPreset({ messageMode: m });
                resetGames();
              }}
            >
              {m === "word" ? "Ord" : "Billede"}
            </button>
          ))}
        </div>

        {config.preset.messageMode === "word" ? (
          <>
            <Label>Hemmelig besked (bogstav pr. station)</Label>
            <input
              value={config.preset.message}
              onChange={(e) => {
                st.patchPreset({ message: e.target.value });
                resetGames();
              }}
              style={input}
            />
          </>
        ) : (
          <>
            <Label>Billede</Label>
            <select
              value={config.preset.pictureId}
              onChange={(e) => {
                st.patchPreset({ pictureId: e.target.value });
                resetGames();
              }}
              style={input}
            >
              {PICTURES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="flex items-center" style={{ gap: 8, margin: "6px 0" }}>
          <input
            type="checkbox"
            checked={config.preset.hop}
            onChange={(e) => {
              st.patchPreset({ hop: e.target.checked });
              resetGames();
            }}
          />
          Frekvens-hop (Hedy)
        </label>

        <details style={{ margin: "6px 0" }}>
          <summary style={{ cursor: "pointer", color: tokens.textMuted }}>Avanceret tuning</summary>
          <NumberRow label="Vindue (bredde)" value={config.preset.width} min={20} max={160} onChange={(v) => { st.patchPreset({ width: v }); resetGames(); }} />
          <NumberRow label="Varme-rækkevidde" value={config.preset.warmRange} min={60} max={300} onChange={(v) => { st.patchPreset({ warmRange: v }); resetGames(); }} />
          <NumberRow label="Lås-tid (ms)" value={config.preset.lockMs} min={300} max={1500} step={50} onChange={(v) => st.patchPreset({ lockMs: v })} />
          <NumberRow label="Narre-toppe" value={config.preset.decoys} min={0} max={5} onChange={(v) => { st.patchPreset({ decoys: v }); resetGames(); }} />
          <NumberRow label="Hop-interval (ms)" value={config.preset.hopIntervalMs} min={1500} max={8000} step={100} onChange={(v) => st.patchPreset({ hopIntervalMs: v })} />
        </details>

        <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
          <button style={btn} onClick={resetGames}>Reset alle</button>
          <button style={btn} onClick={() => engine.revealAll(debug.activeField)}>Afslør felt {debug.activeField + 1}</button>
          <button style={btn} onClick={() => { for (let i = 0; i < config.fieldCount; i++) engine.revealAll(i); }}>Afslør alle</button>
        </div>
      </Section>

      {/* ---- Simulator ---- */}
      <Section title="Simulator">
        <label className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={sim.enabled} onChange={(e) => { st.setSimEnabled(e.target.checked); if (!e.target.checked) simulator.removeAll(); }} />
          Simulator aktiv
        </label>
        <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <button style={btn} onClick={() => { st.setSimEnabled(true); simulator.add("sweep"); }}>+ Sweep</button>
          <button style={btn} onClick={() => { st.setSimEnabled(true); simulator.add("solve"); }}>+ Løs selv</button>
          <button style={btn} onClick={() => { st.setSimEnabled(true); simulator.ensureCount(config.fieldCount, "sweep"); }}>Fyld ({config.fieldCount})</button>
          <button style={btn} onClick={() => simulator.removeAll()}>Fjern alle</button>
        </div>
        <div className="flex" style={{ gap: 6, marginBottom: 8 }}>
          {SIM_MODES.map((m) => (
            <button key={m} style={{ ...btn, flex: 1 }} onClick={() => simulator.setAllModes(m)}>{m}</button>
          ))}
        </div>
        {sim.devices.map((d) => {
          const dev = devices[d.serial];
          return (
            <div key={d.serial} style={{ border: `1px solid ${tokens.panelBorder}`, borderRadius: 8, padding: 6, marginBottom: 6 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ color: tokens.textMuted }}>{d.serial}</span>
                <div className="flex" style={{ gap: 4 }}>
                  <button style={btnSm} onClick={() => simulator.pressButton(d.serial, "A")}>A</button>
                  <button style={btnSm} onClick={() => simulator.pressButton(d.serial, "B")}>B</button>
                  <button style={btnSm} onClick={() => simulator.remove(d.serial)}>✕</button>
                </div>
              </div>
              <input type="range" min={0} max={1000} value={dev?.pos ?? 500} onChange={(e) => simulator.setPos(d.serial, Number(e.target.value))} style={{ width: "100%" }} />
              <select value={d.mode} onChange={(e) => simulator.setMode(d.serial, e.target.value as SimMode)} style={{ ...input, marginTop: 4 }}>
                {SIM_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          );
        })}
      </Section>

      {/* ---- Devices ---- */}
      <Section title={`Enheder (${Object.keys(devices).length})`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: tokens.textMuted, textAlign: "left" }}>
              <th>Serial</th><th>Pos</th><th>Varme</th><th>Felt</th><th>Set</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(devices).map((d) => {
              const snap = snapBySerial.get(d.serial);
              const age = Math.round(now - d.lastSeenMs);
              const offline = age > tokens.timing.offlineMs;
              return (
                <tr key={d.serial} style={{ color: offline ? tokens.bad : "inherit", borderTop: `1px solid ${tokens.panelBorder}` }}>
                  <td style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>{d.serial}</td>
                  <td>{d.pos}</td>
                  <td>{snap ? Math.round(snap.displayWarmth * 100) + "%" : "-"}</td>
                  <td>{snap ? snap.index + 1 : "-"}</td>
                  <td>{age}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* ---- Serial ---- */}
      <Section title="Seriel">
        <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {serial.connected ? (
            <button style={btn} onClick={() => void serialMgr.disconnect()}>Afbryd</button>
          ) : (
            <button style={btn} onClick={() => void serialMgr.connect()}>Forbind</button>
          )}
          <button style={btn} onClick={() => void serialMgr.reconnect()}>Genforbind</button>
          <select value={serial.baud} onChange={(e) => st.setSerial({ baud: Number(e.target.value) })} style={{ ...input, width: "auto", flex: 1 }}>
            {[9600, 38400, 57600, 115200].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={{ color: tokens.textMuted, marginBottom: 6 }}>
          {serial.supported ? (serial.connected ? "✅ Forbundet" : "⚪ Ikke forbundet") : "❌ Web Serial ikke understøttet"}
          {" · "}{serial.linesPerSec}/s · fejl: {serial.parseErrors}
        </div>
        {serial.lastError && <div style={{ color: tokens.bad, marginBottom: 6 }}>⚠ {serial.lastError}</div>}
        <pre style={{ background: "#05080c", borderRadius: 8, padding: 8, maxHeight: 120, overflow: "auto", fontSize: 11, margin: 0, whiteSpace: "pre-wrap" }}>
          {serial.lastLines.slice(-12).join("\n") || "(ingen data)"}
        </pre>
      </Section>

      {/* ---- Overlays / active field ---- */}
      <Section title="Overlays & felt">
        <label className="flex items-center" style={{ gap: 8 }}>
          <input type="checkbox" checked={debug.showFps} onChange={(e) => st.setDebug({ showFps: e.target.checked })} /> FPS
        </label>
        <label className="flex items-center" style={{ gap: 8 }}>
          <input type="checkbox" checked={debug.showOverlays} onChange={(e) => st.setDebug({ showOverlays: e.target.checked })} /> Warmth/lås-overlay
        </label>
        <div style={{ color: tokens.textMuted, margin: "6px 0" }}>FPS: {debug.fps} · frame: {debug.renderLatencyMs}ms</div>
        <Label>Aktivt felt (piletaster flytter nålen)</Label>
        <div className="flex" style={{ gap: 4, flexWrap: "wrap" }}>
          {Array.from({ length: config.fieldCount }, (_, i) => (
            <button key={i} style={{ ...btnSm, background: debug.activeField === i ? tokens.info : "transparent", color: debug.activeField === i ? "#10151c" : tokens.info }} onClick={() => st.setActiveField(i)}>{i + 1}</button>
          ))}
        </div>
        <p style={{ color: tokens.textMuted, marginTop: 8, fontSize: 11 }}>
          Taster: <b>d</b> debug · <b>1–0</b> vælg felt · <b>← →</b> flyt nål · <b>r</b> reset
        </p>
      </Section>
    </aside>
  );
}

// ---- small styled helpers ----
const btn: React.CSSProperties = {
  fontSize: 12,
  padding: "5px 10px",
  borderRadius: 8,
  background: "#0d141d",
  border: `1px solid ${tokens.panelBorder}`,
  color: "#e8eef5",
  cursor: "pointer",
};
const btnSm: React.CSSProperties = { ...btn, padding: "3px 8px" };
const input: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "5px 8px",
  borderRadius: 8,
  background: "#05080c",
  border: `1px solid ${tokens.panelBorder}`,
  color: "#e8eef5",
  marginBottom: 8,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 14, borderTop: `1px solid ${tokens.panelBorder}`, paddingTop: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: tokens.headerText }}>{title}</div>
      {children}
    </section>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color: tokens.textMuted, marginBottom: 4, fontSize: 12 }}>{children}</div>;
}
function NumberRow({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 8, margin: "4px 0" }}>
      <span style={{ color: tokens.textMuted, fontSize: 12 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 44, textAlign: "right" }}>{value}</span>
    </div>
  );
}
