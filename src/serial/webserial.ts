// Web Serial connection manager (Chrome/Edge only). Reads newline-terminated
// packets from the base-station micro:bit, parses them, and feeds the device
// map. Reconnects on its own: at startup it opens a previously-granted port
// without a click, and when the base station is unplugged and plugged back in
// (a real risk on the day) it picks the port up again from the "connect" event.
//
// Minimal Web Serial types are declared locally so the project builds without
// pulling in @types/w3c-web-serial.

import { parseLine } from "./protocol";
import { store } from "@/game/store";

const MICROBIT_VENDOR_ID = 0x0d28; // BBC micro:bit (ARM mbed / DAPLink)
// A line longer than this without a newline is garbage, not a packet.
const MAX_BUFFER = 1000;

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

function getSerial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { serial?: SerialLike };
  return nav.serial ?? null;
}

export class SerialManager {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private loop: Promise<void> | null = null;
  private keepReading = false;
  private opening = false;
  private buffer = "";
  private lineTimestamps: number[] = [];
  private lastRateFlush = 0;
  private initialised = false;

  /** Wire up connect/disconnect handling once, and try a silent auto-connect. */
  init(): void {
    if (this.initialised) return;
    this.initialised = true;
    const serial = getSerial();
    store.get().setSerial({ supported: !!serial });
    if (!serial) return;
    serial.addEventListener("disconnect", (event) => {
      // Only our base station matters; other serial devices may come and go.
      if (this.port && (event.target as unknown) !== this.port) return;
      store.get().setSerial({
        connected: false,
        lastError: "Base-station frakoblet",
      });
      this.keepReading = false;
    });
    serial.addEventListener("connect", () => {
      // A granted port was plugged (back) in — reopen it without a click.
      void this.reconnect(true);
    });
    void this.reconnect(true);
  }

  get supported(): boolean {
    return !!getSerial();
  }

  /** Prompt the user to pick the base-station port, then start reading. */
  async connect(baud?: number): Promise<void> {
    const serial = getSerial();
    if (!serial) {
      store.get().setSerial({ supported: false, lastError: "Web Serial understøttes ikke i denne browser" });
      return;
    }
    try {
      const baudRate = baud ?? store.get().serial.baud;
      const port = await serial.requestPort();
      await this.openAndRead(port, baudRate);
    } catch (err) {
      store.get().setSerial({ lastError: describeError(err) });
    }
  }

  /**
   * Reconnect to a previously-granted port without a new prompt. `silent` is
   * used by the automatic attempts (startup, plug-in) so they don't show an
   * error when there is simply nothing to connect to yet.
   */
  async reconnect(silent = false): Promise<void> {
    const serial = getSerial();
    if (!serial) return;
    try {
      const baudRate = store.get().serial.baud;
      const ports = await serial.getPorts();
      const port = ports.find((p) => p.getInfo?.().usbVendorId === MICROBIT_VENDOR_ID) ?? ports[0];
      if (!port) {
        if (!silent) store.get().setSerial({ lastError: "Ingen kendt port — brug Forbind" });
        return;
      }
      await this.openAndRead(port, baudRate);
    } catch (err) {
      store.get().setSerial({ lastError: describeError(err) });
    }
  }

  private async openAndRead(port: SerialPortLike, baudRate: number): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    try {
      // Already reading this port (e.g. a "connect" event for it) — nothing to do.
      if (this.port === port && this.loop) return;
      // Switching ports, or a manual reconnect: shut the old one down cleanly.
      if (this.loop) await this.disconnect();
      await port.open({ baudRate });
      this.port = port;
      this.keepReading = true;
      this.buffer = "";
      const info = port.getInfo?.();
      store.get().setSerial({
        connected: true,
        baud: baudRate,
        lastError: null,
        portLabel: info?.usbVendorId
          ? `USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)}`
          : "Seriel port",
      });
      this.loop = this.readLoop(port);
    } finally {
      this.opening = false;
    }
  }

  /**
   * Owns the port for its whole life: reads until stopped, then closes it. The
   * close has to wait for the decoder pipe to let go of port.readable, or
   * port.close() fails ("locked stream") and the port stays open — after which
   * every reconnect fails with "port already open" until the app restarts.
   */
  private async readLoop(port: SerialPortLike): Promise<void> {
    if (!port.readable) {
      // Opened but not readable (device already gone). The await also lets
      // openAndRead store this.loop before we clear it below.
      try {
        await port.close();
      } catch {
        /* ignore */
      }
      if (this.port === port) {
        this.port = null;
        this.loop = null;
        store.get().setSerial({ connected: false, linesPerSec: 0 });
      }
      return;
    }
    const decoder = new TextDecoderStream();
    // Cast around the Uint8Array/BufferSource variance mismatch in lib.dom.
    const source = port.readable as unknown as ReadableStream<BufferSource>;
    const pipeDone = source.pipeTo(decoder.writable).catch(() => {});
    const reader = decoder.readable.getReader();
    this.reader = reader;
    try {
      while (this.keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) this.ingest(value);
      }
    } catch (err) {
      // Unplugging lands here too; keep the clearer "frakoblet" message then.
      if (this.keepReading) store.get().setSerial({ lastError: describeError(err) });
    } finally {
      try {
        await reader.cancel();
      } catch {
        /* already cancelled or errored */
      }
      reader.releaseLock();
      await pipeDone;
      try {
        await port.close();
      } catch {
        /* the device may already be gone (unplugged) */
      }
      if (this.reader === reader) this.reader = null;
      if (this.port === port) {
        this.port = null;
        this.loop = null;
        store.get().setSerial({ connected: false, linesPerSec: 0 });
      }
    }
  }

  private ingest(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, "");
      this.buffer = this.buffer.slice(idx + 1);
      this.handleLine(line);
    }
    if (this.buffer.length > MAX_BUFFER) this.buffer = "";
  }

  private handleLine(line: string): void {
    if (!line) return;
    const s = store.get();
    s.pushSerialLine(line);
    const packet = parseLine(line);
    if (!packet) {
      s.bumpParseError(line);
      return;
    }
    s.upsertDevice(packet.serial, packet.pos, packet.flags);

    // Rolling lines/sec, flushed a few times per second.
    const now = performance.now();
    this.lineTimestamps.push(now);
    while (this.lineTimestamps.length && now - this.lineTimestamps[0] > 1000) {
      this.lineTimestamps.shift();
    }
    if (now - this.lastRateFlush > 400) {
      this.lastRateFlush = now;
      store.get().setSerial({ linesPerSec: this.lineTimestamps.length });
    }
  }

  /** Stop reading and wait until the port is really closed. */
  async disconnect(): Promise<void> {
    this.keepReading = false;
    const loop = this.loop;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    if (loop) await loop;
    store.get().setSerial({ connected: false, linesPerSec: 0 });
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "NotFoundError") return "Ingen port valgt";
    return err.message;
  }
  return String(err);
}

let serialSingleton: SerialManager | null = null;
export function getSerialManager(): SerialManager {
  if (!serialSingleton) serialSingleton = new SerialManager();
  return serialSingleton;
}
