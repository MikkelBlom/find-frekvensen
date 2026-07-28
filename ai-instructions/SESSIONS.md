# SESSIONS

Chronological log. Newest at the bottom.

---

## 2026-07-21 — Claude Code (Opus 4.8) — Initial build

**Summary:** Built the whole app from the build-spec in one session.

- Scaffolded Next.js 16 + TS + Tailwind v4; removed `next/font/google` for
  offline safety; disabled the dev indicator.
- Game core: types, design tokens, field themes (numbers/animals/space/
  pioneers), difficulty presets (green/yellow/red), game factory (stations,
  decoys, hop), Zustand store.
- Engine: single rAF loop with hidden-tab timer fallback — device→field
  assignment, warmth/lock/reveal/complete/hop logic, canvas drawing, low-rate
  snapshots to the store.
- Renderer: retro dial (cached faceplate), needle, warmth halo, snow tiles that
  clear with signal, signal meter, lock ring, confetti.
- Inputs: simulator (sweep/solve/manual/idle) and Web Serial reader (tolerant
  parser, graceful reconnect) — both feed one device map.
- Optional WebAudio (lock pling / complete jingle), starts muted.
- UI: TopBar, FieldGrid, RadioField (canvas + DOM tray + celebration),
  MessageTray, PictureReveal, full DebugPanel; keyboard controls; `window.
  __frekvens` test API.
- Word mode **and** picture mode; fields 1–10; live difficulty/theme switching.
- Firmware: MakeCode receiver + base-station + `firmware/README.md`.
- `npm run shots` (Playwright) drives 11 states at 1080p and a subset at 4K.

**Issues encountered:**
- rAF is paused in the offscreen preview (tab hidden) → engine looked dead.
  Added a `setInterval` fallback that steps only when `document.hidden`.
- First-pass visuals: complete state showed heavy static (looked broken); lock
  flash + warmth halo + a circular clear-window were far too large. Fixed:
  clear/full-meter on complete, small flash, tight halo, removed the porthole
  clear-window in favour of global noise reduction + a soft vertical clear column.
- Lint: no `performance.now()` in render → engine stamps `debug.clockMs`.

**State:** `npm run build`, `npx tsc --noEmit`, and `npx eslint .` all clean.
UI reviewed via screenshots against the §7.1 checklist — passes. Runs fully in
the simulator with no hardware.

**Next steps:**
- Verify the real micro:bit → base-station → app chain and tune `SPEED`/
  `DEAD_ZONE` in `firmware/receiver.js` (see WORKING_NOTES "Not yet verified").
- Optional: visual-regression baseline compare in `shots`; a slim operator
  toolbar; persist config to localStorage.
- Separate Appendix task (not this app): Grace "Bug-jagten" Scratch `.sb3`
  projects.

---

## 2026-07-23 — Claude Code (Opus 4.8) — Firmware pass (parallel to web rebuild)

**Summary:** Reworked both micro:bit programs while another session rebuilds the
web portion. No web/game code touched.

- Verified every radio/sensor API used against the MakeCode reference
  (`setGroup`, `setTransmitPower`, `sendString` **19-char cap**, `onReceivedString`,
  `serial.setBaudRate`/`writeLine`, `input.acceleration(Dimension.X)`,
  `onButtonPressed`, `control.deviceSerialNumber()`) — all correct as used.
- Rewrote `firmware/receiver.js` (handheld TRANSMITTER) and
  `firmware/basestation.js` (PC RECEIVER): unchanged line protocol
  `R,<serial>|<pos>|<flags>`, clearer role-first headers, added a power-on
  heartbeat icon on both. Confirmed the handheld is **one universal script**
  (identity via `deviceSerialNumber()`, nothing per-device).
- `firmware/README.md`: added a plain-language "which micro:bit gets which"
  table to defuse the naming clash (repo's in-game "receiver" = the child's
  handheld, which is the radio *transmitter*), and a radio-congestion note
  (raise `TICK_MS` to 130–150 for 8–10 handhelds).

**Issues encountered:** Terminology mismatch — the operator thinks
"receiver = the unit in the PC", but the repo/`CLAUDE.md` invariant names the
handheld `receiver.js`. Kept the canonical filenames (referenced across docs)
and resolved it with explicit headers + the README table; flagged a rename as
the user's call.

**State:** Firmware only; not flashed to hardware this session. APIs
doc-verified.

**Next steps:**
- Flash to real units and run the micro:bit → base-station → app chain end to
  end; tune `SPEED`/`DEAD_ZONE`/`TICK_MS` on the day (WORKING_NOTES "Not yet
  verified").
- Decide whether to rename firmware files to the operator's mental model
  (`transmitter.js` / `receiver.js`) — would also touch `CLAUDE.md`, README, notes.

---

## 2026-07-23 — Claude Code (Opus 4.8) — Light-mode redesign + per-field levels

**Summary:** Reworked the whole look and several mechanics after operator feedback
(strong light-mode preference; the dark UI read as "AI slop"; wanted per-field
progression, click-to-reset, and a fix for the jittery device table).

- **Theme system.** Split colour out of `tokens.ts` into `src/game/palette.ts`
  (light + dark). **Light is the default**; dark is opt-in and persisted to
  localStorage, toggled in the top bar. Canvas + DOM both read the active
  `Palette`. Aesthetic: warm vintage radio — cream illuminated dials, wood
  cabinets, restrained non-neon accents, dark grain on light (light grain on
  dark). Dropped emoji-as-icon in the chrome (inline SVG marks; numbered badges
  for the "numbers" theme).
- **Per-field difficulty ladder.** `config.preset` → `config.levels` (green,
  yellow, red working copies). Each field climbs green→yellow→red independently
  (`PanelRuntime.levelIndex`, advances on complete, caps at red; a new device
  starts at green). Level badge shown per field.
- **Reset.** Per-field ↻ button → `resetPanelToStart`; "Nulstil alle" in the top
  bar → `resetAllToStart`; debug "Sæt alle til niveau".
- **Overlap fix:** the signal meter is hidden while a field is waiting, so the
  "tune in" prompt has clean space.
- **Debug panel** rewritten (by a sub-agent) for the palette + per-field levels
  and the jitter fix: `table-layout: fixed` + `tabular-nums` + clamped/stable
  age formatting so numeric readouts never reflow.

**State:** `npm run build`, `tsc`, `eslint` clean. Reviewed light + dark
screenshots (incl. 4K) — passes the §7.1 checklist. Saved user memories:
prefers-light-mode, avoid-ai-slop-design.

**Next steps:**
- Live-verify per-field progression timing feels right (7 s celebrate → advance).
- Optional: tidy remaining emoji in the operator debug panel; more pictures for
  image mode.

---

## 2026-07-23 — Claude Code (Opus 4.8) — Portable Electron .exe

**Summary:** Packaged the app as a self-contained portable Windows .exe so it can
run on a venue screen PC with nothing installed and no internet (operator wasn't
sure they'd have their own PC).

- `next.config.ts` → `output: "export"`: `next build` now writes a static `out/`.
- `electron/main.js`: tiny Node http server serves `out/` over 127.0.0.1 (a
  secure context, required for Web Serial), loaded fullscreen. Auto-selects the
  base-station micro:bit by USB vendor id 0x0d28 in the `select-serial-port`
  handler — no port picker. F11/Esc fullscreen, Ctrl+Q quit, single-instance.
- `package.json`: `main` → electron, scripts `electron`/`dist`/`exe`, and an
  electron-builder `build` block (win portable → `dist/Find-Frekvensen-<ver>.exe`).
  Moved next/react/zustand to devDependencies so the exe bundles only Electron +
  `out/` (lean). `/dist` gitignored.
- Validated the static-server logic against the real `out/` (root, SPA fallback,
  asset content-types all correct). Could not launch-test the GUI here (no
  display / no hardware) — needs a real double-click + micro:bit check.

**Standing ask:** rebuild the exe (`npm run exe`) after any app change. Saved as
memory `rebuild-exe-after-changes`.

**Next steps:**
- Double-click the exe on a real Windows desktop and confirm it opens fullscreen
  and auto-connects to the base station.

---

## 2026-07-23 — Claude Code (Opus 4.8) — Fix V1 serial corruption (checksum)

**Summary:** Diagnosed and fixed the "one handheld spawns 60 phantom players"
bug from a real hardware test. Root cause: **micro:bit V1 drops bytes on its USB
serial at 115200** (confirmed from the raw line log — dropped `|`, digits, and
`R,` prefixes; ~16–25 `fejl`). Interface firmware was already current (0258) and
a cable swap did nothing, so it's inherent V1 flakiness, not config.

- **Base station** (`basestation.js`): added `led.enable(false)` (frees the LED
  refresh interrupt so the UART drops fewer bytes) and dropped the LED
  heartbeat/toggle + forever loop. Shows a one-time ✓ then goes dark.
- **Checksum protocol** (the real fix). Handheld now sends
  `<id>|<pos>|<flags>|<checksum>` where `id = abs(deviceSerialNumber) % 1e6`
  (shorter → fewer bytes) and `checksum` is a rolling hash (`h=(h*31+c)%10000`)
  over the payload. `receiver.js` builds it; `src/serial/protocol.ts` `parseLine`
  now requires exactly 4 all-digit fields and a matching checksum, else returns
  null. Corruption → dropped packet, not a phantom. The two `checksum()` must
  stay byte-identical.
- Verified the algorithm in Node against the exact corruptions from the logs:
  all 7 hand-picked manglings and **all 17 single-byte deletions rejected, 0
  false-accepts**.
- Docs updated: `firmware/README.md` (new format + V1 troubleshooting +
  re-flash-everything warning), `firmware/basestation.js` header,
  `docs/architecture.md` serial-protocol section.

**Issues / coordination:**
- **Protocol changed**, so BOTH ends must be re-flashed: every handheld
  (`receiver.js`) AND the base station (`basestation.js`). Old 3-field firmware
  is (correctly) rejected wholesale by the new parser.
- I edited **`src/serial/protocol.ts`** (normally the web session's lane). The
  web rebuild must keep this checksum verify in sync with the firmware.
- App is shipped as a portable Electron exe (`rebuild-exe-after-changes`): after
  this `protocol.ts` change, **rebuild the exe** (`npm run exe`) or run the dev
  server, or the running app won't have the checksum gate.

**State:** Firmware + parser written and doc-verified; algorithm unit-checked in
Node. Not yet re-flashed to hardware / re-tested end to end by the operator.

**Next steps:**
- Re-flash all handhelds + base station, reconnect, confirm `Enheder` shows one
  device per micro:bit and `fejl` no longer produces phantoms.
- If clean-packet throughput is low with 8–10 kids, consider `TICK_MS` 100→120.

**RESOLUTION (same day, on hardware):** the checksum fix works — one bit runs
clean and smooth (`9/s · fejl: 3`, errors only at connect, no growth, no
phantoms). And the *real* root cause of the original mangling was found: **two
apps on the same serial port**. The **MakeCode editor** was connected to the base
station while the web app read it too; they split the byte stream and both got
shredded. Closing MakeCode → instantly clean. So "V1 drops bytes at 115200" was a
wrong theory — a lone V1 at 115200 is fine. The checksum is still the reason the
failure was diagnosable (clean drops + flicker, not phantoms). Docs corrected
(README troubleshooting, architecture serial-protocol). Operational rule for the
day: flash bits → close MakeCode → only the game app touches the base-station
port. Saved memories: `serial-port-contention-gotcha`, `microbit-hardware-labels`
(red=base, green=transmitter, yellow=spare). Not yet tested with 2+ handhelds.
