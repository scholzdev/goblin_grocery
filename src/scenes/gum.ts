import Phaser from 'phaser';
import { GUM } from '../data/enemies';
import { DEPTH } from './fx';
import type { ArenaScene } from './ArenaScene';

interface Glob { x: number; y: number; r: number; age: number; life: number; owner: number; img: Phaser.GameObjects.Image }

/** Sticky pink puddles from Bubble Gum: they slow the player's walk (never the dash). */
export class GumPuddles {
  private list: Glob[] = [];
  private stuck = false;
  constructor(private scene: ArenaScene) {}

  /** Walk speed multiplier. */
  slow(): number { return this.stuck ? 1 - GUM.slow : 1; }

  count(owner: number): number { return this.list.reduce((n, g) => n + (g.owner === owner ? 1 : 0), 0); }

  drop(owner: number, x: number, y: number, rMult = 1): void {
    const r = GUM.radius * rMult;
    const img = this.scene.add.image(x, y, 'fx_puddle').setDepth(DEPTH.decal - 0.2).setTint(0xff7fb8).setDisplaySize(r * 2.3, r * 1.45).setAlpha(0);
    this.list.push({ x, y, r, age: 0, life: GUM.life, owner, img });
  }

  update(dt: number): void {
    for (const g of this.list) {
      g.age += dt;
      g.img.setAlpha(Math.min(1, g.age * 5) * Math.min(1, (g.life - g.age) / 1.2) * 0.9);
    }
    this.list = this.list.filter((g) => (g.age < g.life ? true : (g.img.destroy(), false)));
    this.stuck = this.list.some((g) => g.age > 0.15 && this.scene.playerNear(g.x, g.y).d < g.r * 0.8);
  }

  clear(): void {
    for (const g of this.list) g.img.destroy();
    this.list = [];
    this.stuck = false;
  }
}
