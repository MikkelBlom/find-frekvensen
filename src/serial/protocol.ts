// Line protocol between the base-station micro:bit and the app.
//
//   R,<serial>|<pos>|<flags>\n
//
//   serial : integer device serial number (may be negative)
//   pos    : 0–1000 needle position
//   flags  : integer bitmask (bit0 = A, bit1 = B)
//
// Example:  R,-1609443033|734|0
//
// Parsing is deliberately tolerant: anything malformed returns null and is
// counted as a parse error in the debug panel rather than crashing.

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

  const parts = body.split("|");
  if (parts.length < 2) return null;

  const serial = parts[0].trim();
  if (!/^-?\d+$/.test(serial)) return null;

  const pos = Number(parts[1]);
  if (!Number.isFinite(pos)) return null;

  const flags = parts.length >= 3 ? Number(parts[2]) : 0;
  if (!Number.isFinite(flags)) return null;

  return {
    serial,
    pos: clamp(Math.round(pos), 0, 1000),
    flags: Math.max(0, Math.round(flags)) || 0,
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
