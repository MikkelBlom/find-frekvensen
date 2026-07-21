// Web Serial connection manager (Chrome/Edge only). Reads newline-terminated
// packets from the base-station micro:bit, parses them, and feeds the device
// map. Designed to reconnect gracefully if the base station is unplugged and
// plugged back in (a real risk on the day).
//
// Minimal Web Serial types are declared locally so the project builds without
// pulling in @types/w3c-web-serial.

import { parseLine } from "./protocol";
import { store } from "@/game/store";

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
  addEventListener(type: string, listener: () => void): void;
}

function getSerial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { serial?: SerialLike };
  return nav.serial ?? null;
}

export class SerialManager {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private keepReading = false;
  private buffer = "";
  private lineTimestamps: number[] = [];
  private lastRateFlush = 0;
  private initialised = false;

  /** Wire up disconnect handling once. */
  init(): void {
    if (this.initialised) return;
    this.initialised = true;
    const serial = getSerial();
    store.get().setSerial({ supported: !!serial });
    if (!serial) return;
    serial.addEventListener("disconnect", () => {
      // The base station was removed — reflect it and stop reading.
      store.get().setSerial({
        connected: false,
        lastError: "Base-station frakoblet",
      });
      this.keepReading = false;
    });
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

  /** Reconnect to a previously-granted port without a new prompt. */
  async reconnect(): Promise<void> {
    const serial = getSerial();
    if (!serial) return;
    try {
      const baudRate = store.get().serial.baud;
      const ports = await serial.getPorts();
      const port = ports[0];
      if (!port) {
        store.get().setSerial({ lastError: "Ingen kendt port — brug Forbind" });
        return;
      }
      await this.openAndRead(port, baudRate);
    } catch (err) {
      store.get().setSerial({ lastError: describeError(err) });
    }
  }

  private async openAndRead(port: SerialPortLike, baudRate: number): Promise<void> {
    await port.open({ baudRate });
    this.port = port;
    this.keepReading = true;
    const info = port.getInfo?.();
    store.get().setSerial({
      connected: true,
      baud: baudRate,
      lastError: null,
      portLabel: info?.usbVendorId
        ? `USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)}`
        : "Seriel port",
    });
    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    const port = this.port;
    if (!port?.readable) return;
    const decoder = new TextDecoderStream();
    // Cast around the Uint8Array/BufferSource variance mismatch in lib.dom.
    const source = port.readable as unknown as ReadableStream<BufferSource>;
    const readable = source.pipeThrough(decoder);
    this.reader = readable.getReader();
    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.ingest(value);
      }
    } catch (err) {
      store.get().setSerial({ lastError: describeError(err) });
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {
        /* ignore */
      }
      this.reader = null;
      await this.closePort();
      store.get().setSerial({ connected: false });
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

  async disconnect(): Promise<void> {
    this.keepReading = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    await this.closePort();
    store.get().setSerial({ connected: false, linesPerSec: 0 });
  }

  private async closePort(): Promise<void> {
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.port = null;
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
