# Firmware — micro:bit

Two programs. Written for [MakeCode](https://makecode.microbit.org) in the
JavaScript (Static TypeScript) view. **micro:bit V2 recommended** for all units —
the radio is more reliable and they're all the same hardware.

## Files

| File | Flash to | How many |
|------|----------|----------|
| `receiver.js` | Every micro:bit a child holds | 4–8 (all identical) |
| `basestation.js` | The one micro:bit plugged into the computer | 1 |

The receiver firmware is identical on every unit — devices are told apart by
`control.deviceSerialNumber()`, so there is nothing per-device to configure.

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
- **Line format:** the base station prints `R,<serial>|<pos>|<flags>` per packet.

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
| `TICK_MS` | Packet rate (100 ≈ 10/sec) | keep 90–120 |

If tilting feels too hard for the youngest children, you can lean entirely on
the **A / B buttons** for stepping — the app treats the reported position the
same either way.

## Sanity check without receivers

The web app has a full **simulator** (press `d`, or open `?sim=1`) so you can
test the whole game — including all difficulty levels — with no micro:bits at
all. Use it to prepare and to demo while the hardware is charging.
