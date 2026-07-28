# Architecture

## Data flow

```mermaid
flowchart LR
  subgraph Hardware
    R1[Receiver micro:bit ×N<br/>tilt → pos] -- radio group 7 --> BS[Base-station<br/>micro:bit]
  end
  BS -- USB serial 115200<br/>R,id|pos|flags|checksum --> SM[SerialManager]
  SIM[Simulator<br/>sweep/solve/manual/idle] --> DEV
  SM --> DEV[(devices map<br/>in Zustand store)]
  DEV --> ENG[GameEngine loop]
  CFG[(config: fields, preset,<br/>theme, sound)] --> ENG
  ENG -- draws --> CAN[Field canvases]
  ENG -- low-rate snapshots --> SNAP[(snapshots)]
  SNAP --> UI[React chrome<br/>titles, tray, banners]
  ENG -- lock/complete events --> AUD[AudioManager<br/>optional]
```

The key idea: **sim and serial both write the same `devices` map**, and the
engine only reads that map. So the game is identical with or without hardware.

## Module map

| Path | Responsibility |
|------|----------------|
| `src/game/types.ts` | All domain types. |
| `src/game/tokens.ts` | Single source of sizes + shared design values (canvas + DOM). |
| `src/game/palette.ts` | Light + dark palettes; light is the default. |
| `src/game/themes.ts` | Field identities (icon/name/accent) per theme. |
| `src/game/pictures.ts` | Inline-SVG scenes for picture mode. |
| `src/game/presets.ts` | Difficulty presets + default config. |
| `src/game/gameFactory.ts` | Build stations/decoys from a preset; hop logic. |
| `src/game/store.ts` | Zustand store (config/devices/snapshots/serial/sim/debug). |
| `src/game/engine.ts` | The loop: assignment, game logic, draw, snapshots, events. |
| `src/render/drawField.ts` | Retro dial rendering (faceplate + dynamic layers). |
| `src/render/noise.ts` | Pre-baked snow tiles. |
| `src/render/confetti.ts` | Completion particles. |
| `src/sim/simulator.ts` | Virtual devices → device map. |
| `src/serial/protocol.ts` | Parse + checksum-verify `R,id\|pos\|flags\|checksum`. |
| `src/serial/webserial.ts` | Web Serial connect/read/reconnect. |
| `src/audio/sound.ts` | Optional WebAudio SFX. |
| `src/components/*` | TopBar, FieldGrid, RadioField, MessageTray, PictureReveal, DebugPanel. |
| `src/lib/useAppRuntime.ts` | Boots engine/sim/serial/audio, keyboard, URL params, test API. |
| `src/app/*` | Layout + page shell. |
| `firmware/*` | MakeCode receiver + base-station. |
| `electron/main.js` | Portable .exe shell: serves `out/` on loopback, fullscreen, auto-picks the micro:bit port. |
| `scripts/shots.mjs` | Playwright screenshot self-test. |

## Field lifecycle

`waiting` → (device assigned) → `tuning` → (all stations locked) → `complete`
→ (after `completeHoldMs`) → back to `tuning` (device still present) or
`waiting` (device offline > 2 s).

## Serial protocol

`R,<id>|<pos>|<flags>|<checksum>\n` at 115200 baud. `id` = short device id
(hardware serial, `abs % 1_000_000`, non-negative), `pos` = 0–1000, `flags` =
bitmask (bit0 A, bit1 B), `checksum` = rolling hash of `<id>|<pos>|<flags>`
(0–9999). `parseLine` requires exactly four fields and a matching checksum;
anything else is counted as a parse error in the debug panel, never crashes.

The checksum is the integrity gate that turns any corruption into a dropped
packet instead of a phantom "player". The corruption source found on hardware
(2026-07-23) was **two apps reading the same serial port** — the MakeCode editor
open alongside the web app split the byte stream and shredded both; closing
MakeCode fixed it (a lone V1 at 115200 is clean). Radio collisions / bad cables
are a lesser second source. `checksum()` in `src/serial/protocol.ts` must stay
byte-identical to the one in `firmware/receiver.js`.
