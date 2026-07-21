// ============================================================================
// Find Frekvensen — RECEIVER firmware (micro:bit)
//
// Flash this SAME program to EVERY receiver micro:bit the children hold. Devices
// identify themselves via control.deviceSerialNumber(), so there is only one
// firmware to maintain. The micro:bit is intentionally "dumb": it only reports
// its own needle position — all game logic lives in the web app.
//
// How to use: open https://makecode.microbit.org → New Project → click the
// {} JavaScript view → paste this in → Download to the micro:bit.
//
// Behaviour:
//   * Tilt left/right (accelerometer X) moves the needle 0–1000.
//   * A small dead-zone means a roughly level micro:bit holds still.
//   * Buttons A / B nudge the needle a little for fine-tuning near a station.
//   * ~10x/second it broadcasts "<serial>|<pos>|<flags>" on radio group 7.
//   * The LED grid shows a moving column so the device never looks dead.
// ============================================================================

// ---- Tuning constants (adjust to taste on the day) ----
const RADIO_GROUP = 7;
const DEAD_ZONE = 150; // mg; ignore small tilts so a level board holds still
const SPEED = 35; // needle units per tick at full tilt (~3–4s for full sweep)
const BUTTON_STEP = 22; // fine-tune nudge per A/B press
const TICK_MS = 100; // ~10 packets/sec

radio.setGroup(RADIO_GROUP);
radio.setTransmitPower(7); // max range for a busy room

let pos = 500; // start in the middle
let flags = 0; // bit0 = A pressed since last send, bit1 = B pressed
const serial = control.deviceSerialNumber();

// Buttons fine-tune the needle and set a flag the app can also see.
input.onButtonPressed(Button.A, function () {
  pos = clamp(pos - BUTTON_STEP);
  flags = flags | 1;
});
input.onButtonPressed(Button.B, function () {
  pos = clamp(pos + BUTTON_STEP);
  flags = flags | 2;
});

basic.forever(function () {
  const x = input.acceleration(Dimension.X); // -1023..1023

  // Tilt outside the dead-zone moves the needle; direction follows the tilt.
  if (x > DEAD_ZONE || x < -DEAD_ZONE) {
    pos = clamp(pos + (SPEED * x) / 1023);
  }

  showColumn(pos);

  // Broadcast a compact packet, then clear the one-shot button flags.
  radio.sendString(serial + "|" + Math.round(pos) + "|" + flags);
  flags = 0;

  basic.pause(TICK_MS);
});

// Keep the needle within 0..1000.
function clamp(v: number): number {
  if (v < 0) return 0;
  if (v > 1000) return 1000;
  return v;
}

// Light a vertical column at the mapped horizontal position (a little "needle").
function showColumn(p: number): void {
  let col = Math.floor((p / 1000) * 5);
  if (col > 4) col = 4;
  if (col < 0) col = 0;
  basic.clearScreen();
  for (let y = 0; y <= 4; y++) {
    led.plot(col, y);
  }
}
