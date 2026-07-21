// Optional sound. Sound is a pure "plus" — the game is fully playable silently,
// and every call here is a no-op unless it has been explicitly enabled (which
// also resumes the AudioContext from a user gesture, satisfying autoplay rules).
//
// Synthesised with WebAudio so there are no audio assets to ship (offline-safe).

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;

  /** Enable + (re)create the audio graph. Call from a click handler. */
  async enable(): Promise<void> {
    this.enabled = true;
    if (!this.ctx) {
      const Ctor =
        (window.AudioContext as typeof AudioContext) ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
    try {
      await this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  disable(): void {
    this.enabled = false;
  }

  private beep(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 1): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = this.ctx.currentTime + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A short bright "pling" when a station locks. */
  playLock(): void {
    if (!this.enabled || !this.ctx) return;
    this.beep(880, 0, 0.18, "triangle", 0.9);
    this.beep(1320, 0.04, 0.16, "sine", 0.5);
  }

  /** A little rising arpeggio when a field completes. */
  playComplete(): void {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((n, i) => this.beep(n, i * 0.1, 0.32, "triangle", 0.8));
  }
}

let audioSingleton: AudioManager | null = null;
export function getAudio(): AudioManager {
  if (!audioSingleton) audioSingleton = new AudioManager();
  return audioSingleton;
}
