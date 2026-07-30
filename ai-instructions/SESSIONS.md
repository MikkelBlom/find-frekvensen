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

---

## 2026-07-23 — Claude Code — Gameplay rework (logged retroactively)

**Summary:** Reconstructed on 2026-07-28 from commits `21e8543`, `43b906c`,
`c3a5cef`, `f99b661`, which shipped without a session entry.

- **Settings persist** across a refresh (localStorage), versioned so a bump
  resets difficulty levels to new defaults while keeping fields/theme/sound.
- **Arrow-key needle control fixed**; on-screen vip test added; the dial centre
  is kept clear.
- **Honest capture feedback.** The bar and de-noise used to ramp over a much
  wider range than the lock window, so a field looked "done" while the needle
  was still far out — and decoys made it worse. Now the bar only tops out, the
  dial only goes fully sharp/green, and the "LÅS! HOLD" ring only appears when
  the needle is genuinely inside a station window. Warm-but-not-capturable stays
  visibly fuzzy with a capped bar. Decoys default to 0.
- **Directional hint.** A green arrow above the needle points toward the nearest
  signal, so a symmetric bar no longer leaves you guessing which way to go.
  Threshold is per level (`hintFrom`).
- **Moving signal replaces teleport hopping** (`move`/`moveSpeed`/`moveRange`).
  The station slides around its home instead of jumping — you follow it. This is
  the Hedy Lamarr idea, made catchable.
- **No free letters:** station placement excludes a dead zone around the
  needle's *actual* position at (re)start, not just the centre.
- **Ladder retuned** to green 3 letters (ADA, stationary) / yellow 4 (HEDY,
  moving 110 u/s) / red 5 (GRACE, moving 135 u/s, faint late hint). Speeds and
  window widths chosen so dwell time is shorter than `lockMs` — a still needle
  can never catch a moving signal.

**Verified in-browser:** capturable → bar 1.0/green/LÅS; 90 u away → bar 0.55 +
arrow, no lock; needle held at 760 after restart → 0 captured; standing still on
red for 10 s captured nothing.

---

## 2026-07-28 — Claude Code (Opus 5) — Launchpad sync, GitHub, doc catch-up

**Summary:** Housekeeping session. Got the project tracked properly, backed up
off this machine, and brought the notes back in line with the code.

- **Launchpad (project #13):** wrote a real description, six tags, 11 open tasks,
  11 ideas and 8 notes — all grounded in what the repo said was unfinished.
  Pinned the hard invariants and a day-of runbook. Claimed **port 7430** (3000
  is permanently taken on this machine) and pointed `npm run dev`, `npm run
  serve`, `.claude/launch.json`, the screenshot harness and the docs at it;
  verified the server binds it and the app loads clean.
- **Git:** committed the checksum-protocol work that had been sitting in the
  working tree since 2026-07-23, then the Launchpad tracking files, then this
  doc refresh. Created a **private GitHub repo** and pushed — the project had no
  remote at all, so eight commits existed on exactly one disk.
- **Docs:** FEATURES.md had stopped tracking the code four commits back (it
  still listed frequency *hopping* as the red mechanic and didn't mention the
  Electron exe or localStorage persistence at all). Added the missing rows plus
  a hardware-verification table; struck the two FUTURE_IDEAS that have shipped;
  replaced WORKING_NOTES' "not yet verified on real hardware" with the actual
  status; added the serial-port-contention gotcha, the checksum-parity rule and
  the dwell-vs-hold rule to the gotchas list; fixed two stale references
  (`npm run start`, which doesn't exist, and the old 3-field protocol in the
  architecture module map).
- **Rebuilt the .exe** so the artefact matches the current source.

**Hardware update from the operator:** two handhelds have now been tested
together and work perfectly. A final re-flash of all ~10 units is still planned
before the day.

**Next steps:**
- Final re-flash of every handheld + the base station shortly before 12 Oct.
- Verify radio range, tilt feel and 8–10 unit packet load in a venue-sized room;
  tune `SPEED`/`DEAD_ZONE`/`TICK_MS` if needed.
- Still open: visual-regression baselines in `npm run shots`, the slim operator
  toolbar, and the firmware-filename rename decision.

---

## 2026-07-30 — Claude Code (Opus 5) — Launchpad data recovery

**Summary:** Re-established Launchpad tracking after the project's id moved and
its data didn't come with it. No app code touched.

- **The project is now #35, not #13.** Id 13 belongs to "Program Management
  System" today. Project #35 held nothing but a truncated auto-generated
  description — all 6 open tasks, 11 ideas and 8 notes pushed on 2026-07-28 were
  gone, and `launchpad log` showed no history to explain it. A cross-project
  `launchpad search` found none of the items anywhere, so they weren't merged
  into another project.
- **Recovered from `.launchpad-snapshot.json`** — which is *gitignored*, so it
  existed on this disk only and the recovery was luck. (The durable copy is
  `LAUNCHPAD.md`: tracked, and on GitHub. Keep committing it.) Re-pushed the
  full description, six tags, the tasks,
  ideas and notes; verified each one still matches the code before pushing
  (the difficulty-ladder note against `src/game/presets.ts`, the GitHub-remote
  note against `git remote -v`, the port against `package.json`/`launch.json`).
- **Tag naming** aligned to Launchpad's existing global registry — `ui` instead
  of a near-duplicate `ux`, `ops`+`electron` instead of a single-use `build`.
- **Two new items** grounded in what the repo actually says: a task for the stale
  red-level descriptions (below), and a note recording the #13 → #35 move so the
  next session doesn't read the old id in these notes and get lost.
- Port **7430** re-claimed explicitly for #35 (it was only being inferred from
  `.claude/launch.json`), and the stale "no port claimed yet" line in this
  folder's `CLAUDE.md` Launchpad block replaced with the actual port.

**Found but not fixed** (captured as a Launchpad task instead): three places
still describe the pre-2026-07-23 game — teleport hopping, yellow with 2 decoys,
red spelling HEDY. They are `README.md` (intro + the whole Difficulty section +
"red/hop" in the self-test paragraph), `ai-instructions/CLAUDE.md` ("What is
this?"), and the header comment of `src/game/presets.ts`, whose own preset
objects directly below it are correct. The last two matter most — they're what an
agent reads as ground truth.

**Next steps:**
- Fix those three stale descriptions.
- Unchanged from before: final re-flash, the venue-room range/load test, the
  .exe launch test, visual-regression baselines, the firmware rename decision.

---

## 2026-07-30 — Claude Code (Opus 5) — Stale-mechanics cleanup (same day)

**Summary:** Fixed the stale red-level descriptions found in the session above,
and made the Launchpad snapshot a tracked backup. No behaviour changed — every
edit is a comment, a doc, or a filename.

- **Eight places** still described the pre-2026-07-23 game, not three. Beyond
  `README.md`, `ai-instructions/CLAUDE.md` and the `src/game/presets.ts` header,
  the same "hop" language survived in one-line comments in `src/game/types.ts`
  (×2), `src/game/engine.ts`, `firmware/receiver.js` and
  `docs/architecture.md`'s module map. All corrected to the sliding signal.
- **`CLAUDE.md` invariant #1 was also stale on the wire format** — it still
  showed the pre-checksum `<serial>|<pos>|<flags>`. Now
  `<id>|<pos>|<flags>|<checksum>`.
- **README Difficulty section** rewritten to the real ladder (grøn 3 stationary
  ADA / gul 4 moving 110 u/s HEDY / rød 5 moving 135 u/s GRACE, no decoys), plus
  two things it never said: each field climbs independently, and the moving
  levels are tuned so holding still can never win.
- **Renamed the `j-red-hop` shots scenario to `j-red-moving`** (and `git mv`'d
  its PNG). Done now precisely because the visual-regression baselines don't
  exist yet — after that task lands, the name is expensive to change.
- **`.launchpad-snapshot.json` is no longer gitignored.** It was the only copy
  of this project's Launchpad data during the recovery earlier today and it
  lived on one disk. It is the machine-readable, re-pushable backup that
  `LAUNCHPAD.md` isn't; both are now committed.

**Deliberately left alone:** the "hop" mentions in `FEATURES.md`,
`FUTURE_IDEAS.md` and earlier `SESSIONS.md` entries — those are historical
records of the replacement, and `types.ts:84` already describes the mechanic
correctly.

**Not a re-flash:** the `firmware/receiver.js` change is a comment. The flashed
behaviour is unchanged; don't let the modified file trigger a re-flash on its
own.

**State:** `npx tsc --noEmit` and `npx eslint .` both clean. Did not run
`npm run shots` — nothing rendered changed, so the existing PNGs still stand.

**Next steps:** unchanged — the venue-room range/load test and final re-flash
(Mikkel is handling those), the .exe launch test, visual-regression baselines,
the firmware rename decision.
