# FEATURES

Status: Implemented / In progress / Planned.

| Feature | Status | Notes | Date |
|---------|--------|-------|------|
| Next.js 16 + TS + Tailwind v4 scaffold | Implemented | Offline-safe (no google fonts) | 2026-07-21 |
| Design tokens (single source) | Implemented | `src/game/tokens.ts`, used by canvas + DOM | 2026-07-21 |
| Zustand store (config/devices/snapshots/serial/sim/debug) | Implemented | `src/game/store.ts` | 2026-07-21 |
| Game engine (rAF loop + hidden-tab fallback) | Implemented | assignment, logic, draw, snapshots | 2026-07-21 |
| Retro dial canvas renderer | Implemented | faceplate cache, needle, warmth glow, meter | 2026-07-21 |
| Static/snow overlay (clears with signal) | Implemented | pre-baked noise tiles | 2026-07-21 |
| Warmth + decoys | Implemented | decoys raise felt signal, never lock | 2026-07-21 |
| Lock + reveal + lock flash | Implemented | continuous hold `lockMs` | 2026-07-21 |
| Complete celebration + confetti + auto-reset | Implemented | clean/clear on complete | 2026-07-21 |
| Word mode (letter per station) | Implemented | tray fills in message order | 2026-07-21 |
| Picture mode (tile per station) | Implemented | CSS sprite of inline SVG | 2026-07-21 |
| Field identity themes (numbers/animals/space/pioneers) | Implemented | swappable in debug | 2026-07-21 |
| Difficulty presets (green/yellow/red) + live edit | Implemented | editable working copy | 2026-07-21 |
| Frequency hopping (red) | Replaced | teleport hop → moving signal, see below | 2026-07-23 |
| Multi-field grid 1–10 + auto assignment | Implemented | offline timeout frees fields | 2026-07-21 |
| Simulator (sweep/solve/manual/idle) | Implemented | drives whole game, no hardware | 2026-07-21 |
| Web Serial reader + graceful reconnect | Implemented | tolerant line parser | 2026-07-21 |
| Optional WebAudio (lock/complete) | Implemented | starts muted; pure plus | 2026-07-21 |
| Debug panel (serial/devices/sim/god-mode/overlays) | Implemented | toggle with `d` | 2026-07-21 |
| Keyboard control (select field, arrows, reset) | Implemented | `src/lib/useAppRuntime.ts` | 2026-07-21 |
| Playwright screenshot self-test (1080p + 4K) | Implemented | `npm run shots` | 2026-07-21 |
| Receiver + base-station firmware (MakeCode) | Implemented | `firmware/` | 2026-07-21 |
| Visual regression baseline compare | Planned | spec §7.1.4 (optional) | — |
| Portable Electron .exe (offline, auto-connect) | Implemented | `npm run exe`; static export + loopback server | 2026-07-23 |
| Settings persisted across refresh | Implemented | localStorage, versioned (bump resets levels) | 2026-07-23 |
| Honest capture feedback | Implemented | bar/sharpness top out only inside a lock window | 2026-07-23 |
| Directional arrow hint | Implemented | per-level `hintFrom` warmth threshold | 2026-07-23 |
| Moving-signal hard mode | Implemented | `move`/`moveSpeed`/`moveRange`; replaces hopping | 2026-07-23 |
| 3/4/5 letter ladder (ADA/HEDY/GRACE) | Implemented | dwell < `lockMs`, so a still needle can't catch it | 2026-07-23 |
| No free letters at (re)start | Implemented | dead-zone around the needle's actual position | 2026-07-23 |
| Checksummed serial protocol | Implemented | 4 fields; corruption → dropped packet, not a phantom | 2026-07-23 |
| Light/dark theme system (light default, persisted) | Implemented | `src/game/palette.ts`, top-bar toggle | 2026-07-23 |
| Vintage-radio visual redesign (non-slop) | Implemented | cream dials, wood cabinets, SVG icons | 2026-07-23 |
| Per-field difficulty progression (green→yellow→red) | Implemented | each field climbs independently | 2026-07-23 |
| Click-to-reset single field + reset all | Implemented | ↻ per field; "Nulstil alle" | 2026-07-23 |
| Debug device-table jitter fix | Implemented | fixed table-layout + tabular-nums | 2026-07-23 |
| Docs describe the moving signal, not hopping | Implemented | README, CLAUDE.md, presets/types/engine/firmware comments | 2026-07-30 |
| Two-way channel ("you locked!" back to micro:bit) | Planned | optional v2, spec §3 | — |

## Hardware verification

| Chain | Status | Date |
|-------|--------|------|
| One handheld → base station → app | Verified clean (9 packets/s, errors only at connect) | 2026-07-23 |
| Two handhelds simultaneously | Verified — two fields, no id collisions | 2026-07-28 |
| Full load (8–10 handhelds), radio range, tilt feel | Not yet verified — do before the day | — |
