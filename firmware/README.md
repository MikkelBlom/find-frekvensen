# Firmware — micro:bit

Two programs. Written for [MakeCode](https://makecode.microbit.org) in the
JavaScript (Static TypeScript) view. **micro:bit V2 recommended** for all units —
the radio is more reliable and they're all the same hardware.

## Which micro:bit gets which? (read this first)

There are two roles. The filenames use the **in-game** naming (the handheld is
the "radio receiver" the child tunes), which is the **opposite** of the **radio**
naming — so here is the plain-language map:

| Plain language | File | Radio role | Flash to | How many |
|----------------|------|-----------|----------|----------|
| The **handhelds** the kids hold | `receiver.js` | **transmits** its needle position | every child's micro:bit | 4–8 (up to 10), all identical |
| The **"receiver"** plugged into your PC | `basestation.js` | **receives** radio → USB | the one on the USB cable | exactly 1 |

Every handheld runs the **exact same** `receiver.js` — one universal script.
Devices are told apart by `control.deviceSerialNumber()`, so there is nothing
per-device to configure or change before uploading.

## Flashing

1. Open <https://makecode.microbit.org> → **New Project**.
2. Click the **`{}` JavaScript** button in the toolbar to switch to code view.
3. Paste the whole contents of the file.
4. Connect the micro:bit over USB and click **Download** (pair once via
   *Connect device* for one-click flashing afterwards).
5. Repeat with the same `receiver.js` for every receiver; use `basestation.js`
   for the single base station.

## Radio + serial settings (must match)

- **Radio group:** `7` — the same constant is at the top of both firmware files.
  Change it in *both* if you need to avoid interference from another group.
- **Serial baud:** `115200` — matches the web app's default.
- **Line format:** the base station prints `R,<id>|<pos>|<flags>|<checksum>` per
  packet. The handheld builds the line (including the checksum); the base station
  forwards it verbatim; the app verifies the checksum and drops any bad line.

## Connecting the app

1. Plug the base station micro:bit into the computer.
2. Open the web app in **Chrome or Edge** (Web Serial is required).
3. Click **Forbind base-station** and choose the micro:bit's serial port.
4. Turn on a receiver and tilt it — a field should light up on screen.

If the base station is unplugged and replugged, click **Genforbind** in the
debug panel (press `d`) — the app reconnects to the same port.

## Feel tuning (on the day)

Edit these constants at the top of `receiver.js` if the tilt feel is off:

| Constant | Effect | Try |
|----------|--------|-----|
| `SPEED` | How fast tilting sweeps the needle | lower = slower/calmer |
| `DEAD_ZONE` | How level the board must be to hold still | higher = steadier |
| `BUTTON_STEP` | Fine-tune nudge from A / B | 10–30 |
| `TICK_MS` | Packet rate (100 ≈ 10/sec) | keep 90–150 |

All handhelds share one radio group, so total traffic is
`number-of-handhelds × (1000 ÷ TICK_MS)` packets/sec. With 8–10 units at
`TICK_MS = 100` that's ~100 packets/sec and some will collide and drop — this is
harmless (positions are latest-wins and the app smooths), but if a big crowd
makes the needles feel laggy or jumpy, **raise `TICK_MS` to 130–150** on the
handhelds to thin the traffic. Each send also waits a random 0–30 ms extra, so
units switched on at the same moment don't stay in lock-step and collide on
every packet.

If a handheld does go quiet, its field shows "Mister signal …" and is kept for
30 s (level and found letters intact) before it is freed for someone else.

If tilting feels too hard for the youngest children, you can lean entirely on
the **A / B buttons** for stepping — the app treats the reported position the
same either way.

## Troubleshooting: garbled serial / phantom players

**Symptom:** the app's device list (`Enheder`) fills with dozens of near-identical
serials from a single handheld, needles drift on their own, `fejl` climbs, and the
real device flickers in and out.

**Cause #1 — the big one: two programs reading the same serial port.** If the
**MakeCode editor** (or its serial console, an Arduino monitor, another tab —
anything) is connected to the base station while the web app is also reading it,
the two **split the byte stream** and BOTH get shredded, mangled lines. Confirmed
on hardware (2026-07-23): MakeCode open = garbage everywhere; close it → instantly
clean, smooth dial. **On the day, nothing but the game app may touch the base
station's port.** Flash your bits → close MakeCode → then connect the app.

**Cause #2 — genuine line noise:** radio collisions with many handhelds, a
marginal cable, or a V1 board dropping the odd byte under load. Much rarer than #1;
a lone V1 at 115200 is actually fine.

**The defence (built into this firmware):** every packet carries a **checksum**;
the app recomputes it and discards any line that doesn't match — so corruption
becomes a dropped packet (harmless) instead of a phantom player or a jumpy needle.
Verified: every possible single-byte drop is rejected. (This is also why a bad
setup shows the real device *flickering* rather than spawning ghosts — clean
packets get through, mangled ones are dropped, and the device ages out between
them.) The base station additionally runs `led.enable(false)` to keep the
LED-refresh interrupt off the UART under heavy load.

**Because the packet format changed, re-flash BOTH programs:** every handheld with
the new `receiver.js` **and** the base station with the new `basestation.js`. A
handheld on the old 3-field firmware is (correctly) rejected wholesale. The
`checksum()` in `receiver.js` and in `src/serial/protocol.ts` must stay identical.

Don't drop the baud to "fix" noise: at 9600 the link can't carry 8–10 handhelds.

## Sanity check without receivers

The web app has a full **simulator** (press `d`, or open `?sim=1`) so you can
test the whole game — including all difficulty levels — with no micro:bits at
all. Use it to prepare and to demo while the hardware is charging.
