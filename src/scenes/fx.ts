import Phaser from 'phaser';
import { settings } from '../state/settings';

// Pooled, bounded visual effects: particles, damage numbers, floating rings.

const MAX_NUMBERS = 14;
export const DEPTH = { floor: 0, decal: 2, telegraph: 4, world: 10, fx: 5000, bars: 6000, numbers: 7000 };

export class Fx {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private crumbs: Phaser.GameObjects.Particles.ParticleEmitter;
  private puffs: Phaser.GameObjects.Particles.ParticleEmitter;
  private flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private frost: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiEm: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private numbers: Phaser.GameObjects.Text[] = [];
  private numberIdx = 0;

  constructor(private scene: Phaser.Scene) {
    const base = { emitting: false, blendMode: Phaser.BlendModes.NORMAL };
    this.sparks = scene.add.particles(0, 0, 'fx_spark', {
      ...base, speed: { min: 70, max: 190 }, lifespan: 260, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 },
    }).setDepth(DEPTH.fx);
    this.crumbs = scene.add.particles(0, 0, 'fx_crumb', {
      ...base, speed: { min: 60, max: 200 }, lifespan: 420, gravityY: 380, scale: { start: 1, end: 0.6 }, rotate: { min: 0, max: 360 },
    }).setDepth(DEPTH.fx);
    this.puffs = scene.add.particles(0, 0, 'fx_puff', {
      ...base, speed: { min: 20, max: 80 }, lifespan: 420, scale: { start: 0.5, end: 1.1 }, alpha: { start: 0.9, end: 0 },
    }).setDepth(DEPTH.fx);
    this.flames = scene.add.particles(0, 0, 'fx_flame', {
      ...base, speed: { min: 5, max: 30 }, lifespan: 280, scale: { start: 0.9, end: 0.1 }, alpha: { start: 1, end: 0 },
    }).setDepth(DEPTH.fx - 1);
    this.frost = scene.add.particles(0, 0, 'fx_spark', {
      ...base, speed: { min: 40, max: 120 }, lifespan: 380, scale: { start: 0.7, end: 0 }, tint: 0xcff3ff,
    }).setDepth(DEPTH.fx);
    // Particles live in emitter space, so moving the emitter drags in-flight dust along with the player.
    this.dust = scene.add.particles(0, 0, 'fx_puff', {
      ...base, lifespan: 420, moveToX: 0, moveToY: -8, scale: { start: 0.55, end: 0.15 }, alpha: { start: 0.35, end: 0.9 },
    }).setDepth(DEPTH.decal + 1);
    this.confettiEm = scene.add.particles(0, 0, 'fx_confetti', {
      ...base, speed: { min: 80, max: 230 }, lifespan: 650, gravityY: 320, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.6 },
      tint: [0xf45f52, 0xf5bd45, 0x3fb7a6, 0x9081b6, 0x8fcb57],
    }).setDepth(DEPTH.fx);
    for (let i = 0; i < MAX_NUMBERS; i++) {
      this.numbers.push(
        scene.add.text(0, 0, '', {
          fontFamily: '"Luckiest Guy", "Arial Black", sans-serif', fontSize: '22px', color: '#FFF2D5',
          stroke: '#30203F', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(DEPTH.numbers).setVisible(false),
      );
    }
  }

  private n(count: number): number {
    return settings.reducedMotion ? Math.max(1, Math.ceil(count / 2)) : count;
  }

  spark(x: number, y: number, count = 5, tint = 0xffffff): void {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(this.n(count), x, y);
  }
  crumbsAt(x: number, y: number, count = 6, tint = 0xffffff): void {
    this.crumbs.setParticleTint(tint);
    this.crumbs.explode(this.n(count), x, y);
  }
  puff(x: number, y: number, count = 4): void {
    this.puffs.explode(this.n(count), x, y);
  }
  flame(x: number, y: number): void {
    this.flames.emitParticleAt(x, y, 1);
  }
  confetti(x: number, y: number, count = 12): void {
    this.confettiEm.explode(this.n(count), x, y);
  }
  frostBurst(x: number, y: number, count = 8): void {
    this.frost.explode(this.n(count), x, y);
  }

  /** Vacuum dust: keeps the emitter on (x, y) and optionally spawns one mote on the suction ring. */
  suck(x: number, y: number, radius: number, emit: boolean, tint = 0x8c8173): void {
    this.dust.setPosition(x, y);
    if (!emit || (settings.reducedMotion && Math.random() < 0.5)) return;
    const a = Math.random() * Math.PI * 2, r = radius * (0.75 + Math.random() * 0.25);
    this.dust.setParticleTint(tint);
    this.dust.emitParticleAt(Math.cos(a) * r, Math.sin(a) * r * 0.62);
  }

  number(x: number, y: number, value: number, color = '#FFF2D5', size = 22): void {
    this.label(x, y, String(Math.round(value)), color, size);
  }

  label(x: number, y: number, text: string, color = '#FFF2D5', size = 22): void {
    const t = this.numbers[this.numberIdx];
    this.numberIdx = (this.numberIdx + 1) % MAX_NUMBERS;
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setPosition(x + Phaser.Math.Between(-8, 8), y).setColor(color)
      .setFontSize(size).setAlpha(1).setScale(0.6).setVisible(true);
    this.scene.tweens.add({ targets: t, y: y - 34, scale: 1, duration: 160, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 380, duration: 220, onComplete: () => t.setVisible(false) });
  }

  /** One-shot ring image (rings, receipts): expands to `size`, or with `inward` shrinks from it. */
  ring(key: string, x: number, y: number, size: number, duration = 320, tint?: number, inward = false): void {
    const [from, to] = inward ? [size, size * 0.35] : [size * 0.4, size];
    const img = this.scene.add.image(x, y, key).setDepth(DEPTH.decal + 1).setDisplaySize(from, from * 0.62);
    if (tint !== undefined) img.setTint(tint);
    this.scene.tweens.add({
      targets: img, displayWidth: to, displayHeight: to * 0.62, alpha: inward ? { from: 0.6, to: 0 } : { from: 0.95, to: 0 }, duration, ease: inward ? 'Quad.In' : 'Cubic.Out',
      onComplete: () => img.destroy(),
    });
  }

  popImage(key: string, x: number, y: number, scale = 1, depth = DEPTH.fx): void {
    const img = this.scene.add.image(x, y, key).setDepth(depth).setScale(scale * 0.4).setAngle(Phaser.Math.Between(-12, 12));
    this.scene.tweens.add({ targets: img, scale, duration: 140, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: img, alpha: 0, y: y - 20, delay: 360, duration: 260, onComplete: () => img.destroy() });
  }

  /** Bag It: a garbage bag at (x, y) that swells and shrinks for `seconds`, then goes (the blast after it is the combo hook's). */
  garbageBag(x: number, y: number, seconds: number): void {
    const g = this.scene.add.graphics().setPosition(x, y).setDepth(DEPTH.fx - 3);
    g.fillStyle(0x30203f, 1).fillEllipse(0, -12, 34, 30).fillStyle(0x3f6b3a, 1).fillEllipse(0, -12, 28, 24).fillStyle(0x30203f, 1).fillTriangle(-6, -26, 6, -26, 0, -20);
    this.scene.tweens.add({ targets: g, scale: 1.25, duration: seconds * 500, ease: 'Sine.InOut', yoyo: true });
    this.scene.time.delayedCall(seconds * 1000, () => g.destroy());
  }

  shake(intensity = 0.004, duration = 120): void {
    if (!settings.shake || settings.reducedMotion) return;
    this.scene.cameras.main.shake(duration, intensity);
  }
}
