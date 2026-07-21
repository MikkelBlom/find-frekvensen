// A tiny confetti particle system for the "complete" celebration. Drawn on the
// field canvas so it sits over the dial. Frame-rate independent (dt in ms).

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  life: number; // seconds remaining
}

const PALETTE = [
  "#ff6b6b",
  "#ffd23f",
  "#4ecdc4",
  "#a78bfa",
  "#6bcb77",
  "#f78fb3",
  "#5ac8fa",
  "#ff9f43",
];

export class Confetti {
  private particles: Particle[] = [];

  /** Spawn a burst sized to the field. Call once when a field completes. */
  burst(cssW: number, cssH: number, accent: string, count = 90): void {
    const colors = [accent, ...PALETTE];
    for (let i = 0; i < count; i++) {
      const fromTop = Math.random() < 0.6;
      this.particles.push({
        x: Math.random() * cssW,
        y: fromTop ? -10 - Math.random() * cssH * 0.3 : cssH * 0.5,
        vx: (Math.random() - 0.5) * cssW * 0.5,
        vy: (fromTop ? 1 : -1) * (0.2 + Math.random()) * cssH * 0.6,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 12,
        size: cssH * (0.015 + Math.random() * 0.02),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.6 + Math.random() * 1.4,
      });
    }
  }

  get active(): boolean {
    return this.particles.length > 0;
  }

  update(dtMs: number, cssH: number): void {
    const dt = dtMs / 1000;
    const gravity = cssH * 1.1;
    for (const p of this.particles) {
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < cssH + 40);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
  }
}
