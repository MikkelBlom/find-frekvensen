// ============================================================================
// Find Frekvensen — BASE STATION firmware (micro:bit)
//
// Flash this to the ONE micro:bit that stays plugged into the computer over USB.
// It listens on the same radio group as the receivers and prints every packet
// to the USB serial port, one line per packet, for the web app to read via the
// Web Serial API.
//
// Output line format:  R,<serial>|<pos>|<flags>\n   at 115200 baud.
//
// How to use: makecode.microbit.org → New Project → {} JavaScript → paste →
// Download. Then in the web app click "Forbind base-station" and pick this
// micro:bit's serial port.
// ============================================================================

const RADIO_GROUP = 7; // MUST match the receivers

radio.setGroup(RADIO_GROUP);
serial.setBaudRate(BaudRate.BaudRate115200);

// Forward each received packet to USB serial, prefixed with "R,".
radio.onReceivedString(function (received: string) {
  serial.writeLine("R," + received);
  // Brief "alive" blink so you can see traffic on the base station.
  led.toggle(2, 2);
});

// A steady heart in the corner shows the base station is powered and running.
basic.forever(function () {
  led.plot(0, 0);
  basic.pause(500);
  led.unplot(0, 0);
  basic.pause(500);
});
