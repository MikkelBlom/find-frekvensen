// Line protocol between the base-station micro:bit and the app.
//
//   R,<id>|<pos>|<flags>|<checksum>\n
//
//   id       : non-negative device id (hardware serial, shortened to 6 digits)
//   pos      : 0–1000 needle position
//   flags    : integer bitmask (bit0 = A, bit1 = B)
//   checksum : rolling hash of "<id>|<pos>|<flags>", 0–9999
//
// Example:  R,150349|734|0|6044
//
// Why the checksum: micro:bit V1 drops the odd byte on its USB-serial link, so
// lines arrive with digits, "|", or the leading "R," missing. Those manglings
// still LOOK like valid packets (all digits), which is how one handheld spawned
// dozens of phantom "players". The checksum is the integrity gate — a line whose
// recomputed hash doesn't match is discarded as noise. Anything malformed
// returns null and is counted as a parse error in the debug panel.
//
// The checksum() below MUST stay identical to firmware/receiver.js checksum().

export interface ParsedPacket {
  serial: string;
  pos: number;
  flags: number;
}

export function parseLine(raw: string): ParsedPacket | null {
  const line = raw.trim();
  if (!line) return null;

  // Optional "R," prefix from the base station.
  const body = line.startsWith("R,") ? line.slice(2) : line;

  // Exactly four fields. A dropped/added byte changes the field count OR the
  // checksum, so anything that isn't a clean 4-field line is rejected below.
  const parts = body.split("|");
  if (parts.length !== 4) return null;

  const [serial, posStr, flagsStr, sumStr] = parts;

  // All four fields are non-negative integers; a corrupted byte breaks this.
  if (!/^\d+$/.test(serial)) return null;
  if (!/^\d+$/.test(posStr)) return null;
  if (!/^\d+$/.test(flagsStr)) return null;
  if (!/^\d+$/.test(sumStr)) return null;

  // Integrity gate: recompute the hash over the payload and compare.
  const payload = serial + "|" + posStr + "|" + flagsStr;
  if (checksum(payload) !== Number(sumStr)) return null;

  return {
    serial,
    pos: clamp(Math.round(Number(posStr)), 0, 1000),
    flags: Math.max(0, Math.round(Number(flagsStr))) || 0,
  };
}

// Rolling hash, 0..9999. MUST stay identical to firmware/receiver.js checksum().
function checksum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 10000;
  }
  return h;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
