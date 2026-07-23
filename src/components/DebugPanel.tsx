"use client";

import { useState } from "react";
import { useStore } from "@/game/store";
import { getSimulator, type SimMode } from "@/sim/simulator";
import { getSerialManager } from "@/serial/webserial";
import { getEngine } from "@/game/engine";
import { THEMES } from "@/game/themes";
import { PICTURES } from "@/game/pictures";
import { FIELD_COUNT_MIN, FIELD_COUNT_MAX } from "@/game/presets";
import { tokens } from "@/game/tokens";
import { levelColor, type Palette } from "@/game/palette";
import { usePalette } from "@/lib/usePalette";
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
  const palette = usePalette();

  // Which rung of the difficulty ladder the "Spil" controls edit (0=green…).
  const [editIndex, setEditIndex] = useState(0);

  const st = useStore.getState();
  const engine = getEngine();
  const simulator = getSimulator();
  const serialMgr = getSerialManager();
  // Engine-stamped clock (updated while the panel is open) for fresh ages.
  const now = debug.clockMs;

  const btn = mkBtn(palette);
  const btnSm = mkBtnSm(palette);
  const input = mkInput(palette);

  const snapBySerial = new Map<string, PanelSnapshot>();
  snapshots.forEach((s) => {
    if (s.serial) snapBySerial.set(s.serial, s);
  });

  const activeField = debug.activeField;
  const levels = config.levels;
  const editLevel = levels[Math.min(editIndex, levels.length - 1)] ?? levels[0];
  const activeSnap = snapshots.find((s) => s.index === activeField);

  // Any edit that alters the field layout regenerates active games in place.
  const regen = () => engine.regenerateAll();
  // Edit the currently-selected rung of the ladder.
  const patch = (p: Parameters<typeof st.patchLevel>[1]) => st.patchLevel(editIndex, p);

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: "min(400px, 92vw)",
        background: palette.cardBg,
        borderLeft: `1px solid ${palette.cardBorder}`,
        overflowY: "auto",
        zIndex: 50,
        padding: 14,
        fontSize: 13,
        color: palette.title,
        boxShadow: "-8px 0 40px rgba(0,0,0,0.28)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 15, color: palette.title }}>🛠️ Debug</strong>
        <button style={btn} onClick={() => st.toggleDebug()}>
          Luk (d)
        </button>
      </div>

      {/* ---- Game / god mode ---- */}
      <Section title="Spil" palette={palette}>
        <Label palette={palette}>Rediger niveau</Label>
        <div className="flex" style={{ gap: 6, marginBottom: 6 }}>
          {levels.map((lvl, i) => {
            const c = levelColor(palette, lvl.id);
            const selected = editIndex === i;
            return (
              <button
                key={lvl.id}
                style={{
                  ...btn,
                  flex: 1,
                  borderColor: c,
                  background: selected ? c : "transparent",
                  color: selected ? readableOn(c) : c,
                }}
                onClick={() => setEditIndex(i)}
              >
                {lvl.label}
              </button>
            );
          })}
        </div>
        <div style={{ color: palette.textMuted, fontSize: 11, marginBottom: 10 }}>
          Felt {activeField + 1} er på niveau: {activeSnap ? activeSnap.levelLabel : "–"}
        </div>

        <Label palette={palette}>Antal felter: {config.fieldCount}</Label>
        <input
          type="range"
          min={FIELD_COUNT_MIN}
          max={FIELD_COUNT_MAX}
          value={config.fieldCount}
          onChange={(e) => st.setFieldCount(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 8 }}
        />

        <Label palette={palette}>Tema (felt-identitet)</Label>
        <select value={config.themeId} onChange={(e) => st.setThemeId(e.target.value)} style={input}>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <div
          className="flex items-center justify-between"
          style={{ gap: 8, marginBottom: 10 }}
        >
          <span style={{ color: palette.textMuted, fontSize: 12 }}>Udseende</span>
          <button style={btn} onClick={() => st.toggleThemeMode()}>
            {config.themeMode === "light" ? "☀️ Lys" : "🌙 Mørk"}
          </button>
        </div>

        <Label palette={palette}>Besked-type ({editLevel.label})</Label>
        <div className="flex" style={{ gap: 6, marginBottom: 8 }}>
          {(["word", "image"] as const).map((m) => {
            const selected = editLevel.messageMode === m;
            return (
              <button
                key={m}
                style={{
                  ...btn,
                  flex: 1,
                  borderColor: palette.info,
                  background: selected ? palette.info : "transparent",
                  color: selected ? readableOn(palette.info) : palette.info,
                }}
                onClick={() => {
                  patch({ messageMode: m });
                  regen();
                }}
              >
                {m === "word" ? "Ord" : "Billede"}
              </button>
            );
          })}
        </div>

        {editLevel.messageMode === "word" ? (
          <>
            <Label palette={palette}>Hemmelig besked (bogstav pr. station)</Label>
            <input
              value={editLevel.message}
              onChange={(e) => {
                patch({ message: e.target.value });
                regen();
              }}
              style={input}
            />
          </>
        ) : (
          <>
            <Label palette={palette}>Billede</Label>
            <select
              value={editLevel.pictureId}
              onChange={(e) => {
                patch({ pictureId: e.target.value });
                regen();
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

        <label className="flex items-center" style={{ gap: 8, margin: "6px 0", color: palette.title }}>
          <input
            type="checkbox"
            checked={editLevel.move}
            onChange={(e) => {
              patch({ move: e.target.checked });
              regen();
            }}
          />
          Bevægende signal (Hedy) — glider frem og tilbage
        </label>

        <details style={{ margin: "6px 0" }}>
          <summary style={{ cursor: "pointer", color: palette.textMuted }}>Avanceret tuning</summary>
          <NumberRow palette={palette} label="Vindue (bredde)" value={editLevel.width} min={20} max={160} onChange={(v) => { patch({ width: v }); regen(); }} />
          <NumberRow palette={palette} label="Varme-rækkevidde" value={editLevel.warmRange} min={60} max={300} onChange={(v) => { patch({ warmRange: v }); regen(); }} />
          <NumberRow palette={palette} label="Lås-tid (ms)" value={editLevel.lockMs} min={300} max={1500} step={50} onChange={(v) => patch({ lockMs: v })} />
          <NumberRow palette={palette} label="Signal-fart" value={editLevel.moveSpeed} min={0} max={200} step={5} onChange={(v) => patch({ moveSpeed: v })} />
          <NumberRow palette={palette} label="Signal-vandring" value={editLevel.moveRange} min={40} max={400} step={10} onChange={(v) => patch({ moveRange: v })} />
          <NumberRow palette={palette} label="Narre-toppe" value={editLevel.decoys} min={0} max={5} onChange={(v) => { patch({ decoys: v }); regen(); }} />
        </details>

        <Label palette={palette}>Sæt alle felter til niveau</Label>
        <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {levels.map((lvl, i) => {
            const c = levelColor(palette, lvl.id);
            return (
              <button key={lvl.id} style={{ ...btn, flex: 1, borderColor: c, color: c }} onClick={() => engine.setAllToLevel(i)}>
                {lvl.label}
              </button>
            );
          })}
        </div>

        <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => engine.resetAllToStart()}>Nulstil alle</button>
          <button style={btn} onClick={() => engine.resetPanelToStart(activeField)}>Nulstil felt {activeField + 1}</button>
          <button style={btn} onClick={() => engine.revealAll(activeField)}>Afslør felt {activeField + 1}</button>
          <button style={btn} onClick={() => { for (let i = 0; i < config.fieldCount; i++) engine.revealAll(i); }}>Afslør alle</button>
        </div>
      </Section>

      {/* ---- Simulator ---- */}
      <Section title="Simulator" palette={palette}>
        <label className="flex items-center" style={{ gap: 8, marginBottom: 8, color: palette.title }}>
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
            <div key={d.serial} style={{ border: `1px solid ${palette.cardBorder}`, borderRadius: 8, padding: 6, marginBottom: 6, background: palette.faceGlassBottom }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ color: palette.textMuted, fontVariantNumeric: "tabular-nums" }}>{d.serial}</span>
                <div className="flex" style={{ gap: 4 }}>
                  <button style={btnSm} onClick={() => simulator.pressButton(d.serial, "A")}>A</button>
                  <button style={btnSm} onClick={() => simulator.pressButton(d.serial, "B")}>B</button>
                  <button style={btnSm} onClick={() => simulator.remove(d.serial)}>✕</button>
                </div>
              </div>
              <input type="range" min={0} max={1000} value={dev?.pos ?? 500} onChange={(e) => simulator.setPos(d.serial, Number(e.target.value))} style={{ width: "100%" }} />
              <select value={d.mode} onChange={(e) => simulator.setMode(d.serial, e.target.value as SimMode)} style={{ ...input, marginTop: 4, marginBottom: 0 }}>
                {SIM_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          );
        })}
      </Section>

      {/* ---- Devices (fixed layout so numeric values never reflow) ---- */}
      <Section title={`Enheder (${Object.keys(devices).length})`} palette={palette}>
        <div style={{ width: "100%", overflowX: "hidden" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            <colgroup>
              <col style={{ width: "38%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr style={{ color: palette.textMuted }}>
                <th style={thL}>Serial</th>
                <th style={thR}>Pos</th>
                <th style={thR}>Varme</th>
                <th style={thR}>Felt</th>
                <th style={thR}>Set</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(devices).map((d) => {
                const snap = snapBySerial.get(d.serial);
                const age = Math.max(0, now - d.lastSeenMs);
                const offline = age > tokens.timing.offlineMs;
                return (
                  <tr key={d.serial} style={{ color: offline ? palette.bad : palette.title, borderTop: `1px solid ${palette.cardBorder}` }}>
                    <td style={{ ...tdL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.serial}</td>
                    <td style={tdR}>{d.pos}</td>
                    <td style={tdR}>{snap ? Math.round(snap.displayWarmth * 100) + "%" : "–"}</td>
                    <td style={tdR}>{snap ? snap.index + 1 : "–"}</td>
                    <td style={tdR}>{(age / 1000).toFixed(1)}s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---- Serial ---- */}
      <Section title="Seriel" palette={palette}>
        <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {serial.connected ? (
            <button style={btn} onClick={() => void serialMgr.disconnect()}>Afbryd</button>
          ) : (
            <button style={btn} onClick={() => void serialMgr.connect()}>Forbind</button>
          )}
          <button style={btn} onClick={() => void serialMgr.reconnect()}>Genforbind</button>
          <select value={serial.baud} onChange={(e) => st.setSerial({ baud: Number(e.target.value) })} style={{ ...input, width: "auto", flex: 1, marginBottom: 0 }}>
            {[9600, 38400, 57600, 115200].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {/* Status on its own line so its width changes can't shift the numbers. */}
        <div style={{ color: palette.textMuted, marginBottom: 4 }}>
          {serial.supported ? (serial.connected ? "✅ Forbundet" : "⚪ Ikke forbundet") : "❌ Web Serial ikke understøttet"}
        </div>
        <div style={{ color: palette.textMuted, marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
          <span style={numBox}>{serial.linesPerSec}</span>/s · fejl: <span style={numBox}>{serial.parseErrors}</span>
        </div>
        {serial.lastError && (
          <div style={{ color: palette.bad, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            ⚠ {serial.lastError}
          </div>
        )}
        <pre
          style={{
            background: palette.faceGlassBottom,
            color: palette.textOnGlass,
            borderRadius: 8,
            padding: 8,
            // Fixed height (not maxHeight) so adding lines never shifts layout.
            height: 132,
            overflow: "auto",
            fontSize: 11,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {serial.lastLines.slice(-12).join("\n") || "(ingen data)"}
        </pre>
      </Section>

      {/* ---- Overlays / active field ---- */}
      <Section title="Overlays & felt" palette={palette}>
        <label className="flex items-center" style={{ gap: 8, color: palette.title }}>
          <input type="checkbox" checked={debug.showFps} onChange={(e) => st.setDebug({ showFps: e.target.checked })} /> FPS
        </label>
        <label className="flex items-center" style={{ gap: 8, color: palette.title }}>
          <input type="checkbox" checked={debug.showOverlays} onChange={(e) => st.setDebug({ showOverlays: e.target.checked })} /> Warmth/lås-overlay
        </label>
        <div style={{ color: palette.textMuted, margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>
          FPS: <span style={numBox}>{debug.fps}</span> · frame: <span style={numBox}>{debug.renderLatencyMs}</span>ms
        </div>
        <Label palette={palette}>Aktivt felt (piletaster flytter nålen)</Label>
        <div className="flex" style={{ gap: 4, flexWrap: "wrap" }}>
          {Array.from({ length: config.fieldCount }, (_, i) => (
            <button
              key={i}
              style={{
                ...btnSm,
                borderColor: palette.info,
                background: activeField === i ? palette.info : "transparent",
                color: activeField === i ? readableOn(palette.info) : palette.info,
              }}
              onClick={() => st.setActiveField(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {(() => {
          const s = activeSnap?.serial;
          const dev = s ? devices[s] : undefined;
          return (
            <div style={{ marginTop: 10 }}>
              <Label palette={palette}>Fjernstyr felt {activeField + 1} (vip-test)</Label>
              {s ? (
                <>
                  <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
                    <button style={btnSm} onClick={() => simulator.nudge(s, -30)}>◀</button>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      value={dev?.pos ?? 500}
                      onChange={(e) => simulator.setPos(s, Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <button style={btnSm} onClick={() => simulator.nudge(s, 30)}>▶</button>
                  </div>
                  <div className="flex" style={{ gap: 6 }}>
                    <button style={{ ...btnSm, flex: 1 }} onClick={() => simulator.pressButton(s, "A")}>A (fin −)</button>
                    <button style={{ ...btnSm, flex: 1 }} onClick={() => simulator.pressButton(s, "B")}>B (fin +)</button>
                  </div>
                </>
              ) : (
                <div style={{ color: palette.textMuted, fontSize: 12 }}>
                  Ingen enhed på felt {activeField + 1}.{" "}
                  <button
                    style={btnSm}
                    onClick={() => {
                      st.setSimEnabled(true);
                      simulator.ensureCount(config.fieldCount, "manual");
                    }}
                  >
                    Tilføj testenheder
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <p style={{ color: palette.textMuted, marginTop: 8, fontSize: 11 }}>
          Taster: <b>d</b> debug · <b>1–0</b> vælg felt · <b>← →</b> flyt nål (Shift = større) · <b>r</b> reset
        </p>
      </Section>
    </aside>
  );
}

// ---- small styled helpers --------------------------------------------------

/** Black or off-white text, whichever reads better on a filled accent swatch. */
function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#1a140c";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.6 ? "#1a140c" : "#f7efd9";
}

function mkBtn(palette: Palette): React.CSSProperties {
  return {
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 8,
    background: palette.faceGlassBottom,
    border: `1px solid ${palette.cardBorder}`,
    color: palette.title,
    cursor: "pointer",
    fontVariantNumeric: "tabular-nums",
  };
}
function mkBtnSm(palette: Palette): React.CSSProperties {
  return { ...mkBtn(palette), padding: "3px 8px" };
}
function mkInput(palette: Palette): React.CSSProperties {
  return {
    width: "100%",
    fontSize: 12,
    padding: "5px 8px",
    borderRadius: 8,
    background: palette.faceGlassBottom,
    border: `1px solid ${palette.cardBorder}`,
    color: palette.title,
    marginBottom: 8,
  };
}

// Fixed-width, right-aligned, tabular numeric box so swinging values never
// push the text that follows them.
const numBox: React.CSSProperties = {
  display: "inline-block",
  minWidth: 40,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

// Device-table cell styles. tableLayout:"fixed" + these keep columns rigid.
const thL: React.CSSProperties = { textAlign: "left", padding: "2px 4px", fontWeight: 600 };
const thR: React.CSSProperties = { textAlign: "right", padding: "2px 4px", fontWeight: 600, fontVariantNumeric: "tabular-nums" };
const tdL: React.CSSProperties = { textAlign: "left", padding: "2px 4px" };
const tdR: React.CSSProperties = { textAlign: "right", padding: "2px 4px", fontVariantNumeric: "tabular-nums" };

function Section({ title, palette, children }: { title: string; palette: Palette; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 14, borderTop: `1px solid ${palette.cardBorder}`, paddingTop: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: palette.title }}>{title}</div>
      {children}
    </section>
  );
}
function Label({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <div style={{ color: palette.textMuted, marginBottom: 4, fontSize: 12 }}>{children}</div>;
}
function NumberRow({ palette, label, value, min, max, step = 1, onChange }: { palette: Palette; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 8, margin: "4px 0" }}>
      <span style={{ color: palette.textMuted, fontSize: 12 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums", color: palette.title }}>{value}</span>
    </div>
  );
}
