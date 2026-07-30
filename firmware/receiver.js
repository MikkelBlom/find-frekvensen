// ============================================================================
// Find Frekvensen — HANDHELD firmware  (the micro:bit a CHILD holds)
//
//   RADIO ROLE:  TRANSMITTER   — it broadcasts its own needle position.
//   FLASH TO:    every handheld unit (4–8, up to 10). ALL identical.
//   PAIRED WITH: firmware/basestation.js on the one micro:bit in the PC.
//
// ONE UNIVERSAL SCRIPT: flash this exact same code to every handheld. There is
// NOTHING to change per device — each micro:bit tells itself apart with its
// built-in serial number (control.deviceSerialNumber()), which the web app
// uses as the key to give each child their own field on screen.
//
// The micro:bit is intentionally "dumb": it only reports where its needle is.
// ALL game logic — stations, warmth, lock, how the signal moves, the secret
// message — lives in the web app, so puzzles can change with zero re-flashing.
//
// Behaviour:
//   * Tilt LEFT / RIGHT (accelerometer X) sweeps the needle across 0..1000.
//   * A small dead-zone means a roughly level board holds the needle still.
//   * Buttons A / B nudge the needle for fine-tuning right next to a station,
//     and set a one-shot flag the web app can also read.
//   * ~10x/second it broadcasts "<serial>|<pos>|<flags>" on radio group 7.
//   * A moving LED column shows the needle so the unit never looks dead.
//
// Flash: makecode.microbit.org -> New Project -> the {} JavaScript view ->
//        paste this whole file -> Download. Repeat for every handheld.
// micro:bit V2 recommended (more reliable radio); V1 also works.
// ============================================================================

// ---- Tuning constants (safe to tweak on the day; see firmware/README.md) ----
const RADIO_GROUP = 7;   // MUST match basestation.js
const DEAD_ZONE = 150;   // mg; ignore small tilts so a level board holds still
const SPEED = 35;        // needle units per tick at full tilt (~3s full sweep)
const BUTTON_STEP = 22;  // fine-tune nudge per A / B press
const TICK_MS = 100;     // ~10 packets/sec (keep 90-150; raise it if a big
                         // crowd of handhelds makes the screen feel laggy)

// ---- Radio setup ----
radio.setGroup(RADIO_GROUP);
radio.setTransmitPower(7); // 0..7; max for a busy, walled library room

// ---- State ----
let pos = 500;  // needle position 0..1000; start in the middle of the dial
let flags = 0;  // one-shot bitmask, cleared after each send:
                //   bit0 (1) = A was pressed since last send
                //   bit1 (2) = B was pressed since last send
// A SHORT, stable id derived from the hardware serial (up to 6 digits, always
// positive). Shorter = fewer bytes on the wire = fewer chances for a V1
// micro:bit to drop one over USB. Unique enough for a handful of handhelds.
// NB: don't name this `serial` — that's a built-in MakeCode namespace.
const deviceId = Math.abs(control.deviceSerialNumber()) % 1000000;

// Buttons fine-tune the needle AND raise a flag the app can act on.
input.onButtonPressed(Button.A, function () {
  pos = clamp(pos - BUTTON_STEP);
  flags = flags | 1;
});
input.onButtonPressed(Button.B, function () {
  pos = clamp(pos + BUTTON_STEP);
  flags = flags | 2;
});

// A friendly "I'm awake" heartbeat right after power-on / flashing.
basic.showIcon(IconNames.SmallHeart);
basic.pause(500);

basic.forever(function () {
  const x = input.acceleration(Dimension.X); // gravity tilt: about -1023..1023

  // Outside the dead-zone, tilt moves the needle; direction follows the tilt.
  // Dividing by 1023 makes a full ~90 degree tilt equal full SPEED.
  if (x > DEAD_ZONE || x < -DEAD_ZONE) {
    pos = clamp(pos + (SPEED * x) / 1023);
  }

  showColumn(pos);

  // Broadcast "<id>|<pos>|<flags>|<checksum>", then clear the one-shot flags.
  // The checksum lets the app throw away any packet that lost or gained a byte
  // on the flaky V1 USB-serial link (see firmware/README.md). Worst case
  // "999999|1000|3|9999" is 18 chars, within sendString's 19-char limit.
  const payload = deviceId + "|" + Math.round(pos) + "|" + flags;
  radio.sendString(payload + "|" + checksum(payload));
  flags = 0;

  basic.pause(TICK_MS);
});

// Rolling hash over the payload, 0..9999. The web app (src/serial/protocol.ts)
// computes the EXACT same thing and discards any line whose checksum doesn't
// match — that is what filters out the V1 serial corruption. If you change this
// formula, change it in protocol.ts too or nothing will get through.
function checksum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 10000;
  }
  return h;
}

// Keep the needle within 0..1000.
function clamp(v: number): number {
  if (v < 0) return 0;
  if (v > 1000) return 1000;
  return v;
}

// Light a vertical LED column at the needle's horizontal position (a mini dial).
function showColumn(p: number): void {
  let col = Math.floor((p / 1000) * 5);
  if (col > 4) col = 4;
  if (col < 0) col = 0;
  basic.clearScreen();
  for (let y = 0; y <= 4; y++) {
    led.plot(col, y);
  }
}
