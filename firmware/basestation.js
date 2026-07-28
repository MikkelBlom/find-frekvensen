// ============================================================================
// Find Frekvensen — BASE-STATION firmware  (the ONE micro:bit in the PC)
//
//   RADIO ROLE:  RECEIVER  — this is the unit you call the "receiver": it
//                stays plugged into the computer over USB the whole time.
//   FLASH TO:    exactly ONE micro:bit (the one on the USB cable).
//   PAIRED WITH: firmware/receiver.js on every handheld the children hold.
//
// It listens on the same radio group as the handhelds and prints every packet
// it hears to the USB serial port, one line per packet, for the web app to read
// via the Web Serial API. It runs NO game logic — it is a pure radio->USB relay.
//
// Output line format:  R,<id>|<pos>|<flags>|<checksum>\n     at 115200 baud
//   id       : the sending handheld's short device id (non-negative)
//   pos      : 0..1000 needle position
//   flags    : bitmask  (bit0 = A pressed, bit1 = B pressed)
//   checksum : integrity hash the app uses to drop V1 serial corruption
// Example:  R,150349|734|0|6044
// (This program just forwards whatever it hears verbatim — the handheld builds
//  the line and the app checks it. Nothing to configure here.)
//
// Flash: makecode.microbit.org -> New Project -> the {} JavaScript view ->
//        paste this whole file -> Download. Then plug this micro:bit into the
//        PC, open the web app in Chrome/Edge, and click "Forbind base-station".
// ============================================================================

const RADIO_GROUP = 7; // MUST match receiver.js on the handhelds

radio.setGroup(RADIO_GROUP);
serial.setBaudRate(BaudRate.BaudRate115200);

// One-time "flashed OK" tick, THEN turn the LED display off for good.
basic.showIcon(IconNames.Yes);
basic.pause(400);

// IMPORTANT (micro:bit V1): the LED display is redrawn by a constant timer
// interrupt that steals cycles from the USB serial UART and makes it drop
// bytes at 115200 — which shows up in the app as garbled serials / phantom
// players. This base station lives in the PC and needs no display, so we
// disable the driver entirely to keep the serial output clean.
led.enable(false);

// Forward each received radio packet to USB serial, prefixed with "R,".
// Registering this handler keeps the program running; no forever-loop needed.
// The web app tolerates the "R," prefix and ignores anything malformed.
radio.onReceivedString(function (received: string) {
  serial.writeLine("R," + received);
});
