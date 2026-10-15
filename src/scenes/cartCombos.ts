import Phaser from 'phaser';
import { RECIPE_TUNING } from '../data/recipes';
import { EXPIRED_MILK } from '../data/items';
import { applyPoison, tailwindFeedsSugar } from '../systems/combat';
import { store } from '../state/store';
import { play } from '../audio/sfx';
import { DEPTH } from './fx';
import type { RecipeId } from '../types';
import type { ArenaScene } from './ArenaScene';

/** Is this (weaponless or not) combo active in the current cart? */
export const recipeActive = (id: RecipeId): boolean => store.state.build.recipes.some((r) => r.id === id);

/** Sugar Rush: +1 stack (own expiry; at the cap the oldest stack is refreshed). Callers gate on recipeActive('sugarRush'). */
export function addSugarStack(scene: ArenaScene): void {
  const T = RECIPE_TUNING.sugarRush, now = scene.time.now / 1000, c = scene.cartCombos;
  c.sugar = c.sugar.filter((t) => t > now).sort((a, b) => a - b);
  if (c.sugar.length >= T.max) c.sugar[0] = now + T.duration;
  else c.sugar.push(now + T.duration);
}

/** Cart-combo and curse state/effects that do not belong to a weapon: Sugar Rush, Bag It charges, Expired Milk aura. */
export class CartCombos {
  /** Expiry times (s) of the live Sugar Rush stacks. */
  sugar: number[] = [];
  private bag = 0;
  private windUntil = 0;
  private windFed = -Infinity;
  private stinkT = 0;
  private label: Phaser.GameObjects.Text;
  private cloud: Phaser.GameObjects.Graphics;

  constructor(private scene: ArenaScene) {
    this.label = scene.add.text(0, 0, '', { fontFamily: '"Luckiest Guy", "Arial Black", sans-serif', fontSize: '20px', color: '#FFF2D5', stroke: '#30203F', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5, 1).setDepth(DEPTH.bars + 2).setVisible(false);
    this.cloud = scene.add.graphics().setDepth(DEPTH.decal + 1);
  }

  sugarMult(now: number): number {
    return 1 + RECIPE_TUNING.sugarRush.perStack * this.sugar.filter((t) => t > now).length;
  }

  /** Tailwind: move-speed multiplier while a blast's push lasts. */
  windMult(now: number): number {
    return now < this.windUntil ? 1 + RECIPE_TUNING.tailwind.boost : 1;
  }

  /** Tailwind: a leaf blower blast. The push works alone; Sugar Rush stacks need Sugar Rush active. */
  onBlast(): void {
    const T = RECIPE_TUNING.tailwind, now = this.scene.time.now / 1000, p = this.scene.player;
    if (Math.hypot(p.vx, p.vy) > 1) this.windUntil = now + T.boostTime; // no push while standing still
    if (tailwindFeedsSugar(recipeActive('sugarRush'), now, this.windFed, T.sugarIcd)) { addSugarStack(this.scene); this.windFed = now; }
  }

  /** Bag It: a vacuum kill. */
  bagKill(): void {
    const T = RECIPE_TUNING.bagIt;
    this.bag = Math.min(T.max, this.bag + T.perKill);
  }

  /** Called when a dash starts. */
  onShove(): void {
    if (recipeActive('sugarRush')) addSugarStack(this.scene);
    if (recipeActive('bagIt') && this.bag > 0) this.dropBag();
  }

  private dropBag(): void {
    const sc = this.scene, T = RECIPE_TUNING.bagIt, n = this.bag, { x, y } = sc.player;
    this.bag = 0;
    const g = sc.add.graphics().setPosition(x, y).setDepth(DEPTH.fx - 3);
    g.fillStyle(0x30203f, 1).fillEllipse(0, -12, 34, 30).fillStyle(0x3f6b3a, 1).fillEllipse(0, -12, 28, 24).fillStyle(0x30203f, 1).fillTriangle(-6, -26, 6, -26, 0, -20);
    sc.tweens.add({ targets: g, scale: 1.25, duration: T.fuse * 500, ease: 'Sine.InOut', yoyo: true });
    sc.time.delayedCall(T.fuse * 1000, () => {
      g.destroy();
      if (!sc.combatActive()) return;
      sc.fx.ring('fx_boom', x, y, T.radius * 2.4, 380);
      sc.fx.puff(x, y - 10, 5);
      sc.fx.shake(0.004, 110);
      play('boom');
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
        if (d > T.radius + e.def.radius) continue;
        sc.damageEnemy(e, T.dmgPerCharge * n, null, { kb: 220, kbX: dx / (d || 1), kbY: dy / (d || 1), label: 'Bag It' });
      }
    });
  }

  update(dt: number, now: number, active: boolean): void {
    const sc = this.scene, p = sc.player, dps = store.state?.build?.stinkDps ?? 0;
    this.sugar = this.sugar.filter((t) => t > now);
    const lines: string[] = [];
    if (active && this.sugar.length) lines.push(`SUGAR ${'#'.repeat(this.sugar.length)}`);
    if (active && this.bag > 0) lines.push(`BAG x${this.bag}`);
    this.label.setVisible(lines.length > 0).setText(lines.join('\n')).setPosition(p.x, p.y - 110);

    this.cloud.clear();
    if (!active || dps <= 0) return;
    const R = EXPIRED_MILK.radius;
    this.cloud.fillStyle(0x8fcb57, 0.1 + 0.04 * Math.sin(now * 2)).fillEllipse(p.x, p.y, R * 2, R * 1.24);
    if (Math.random() < dt * 4) sc.fx.spark(p.x + Phaser.Math.Between(-R, R) * 0.7, p.y - Phaser.Math.Between(0, 40), 1, 0x8fcb57);
    if ((this.stinkT -= dt) > 0) return;
    this.stinkT = EXPIRED_MILK.interval;
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn' || Math.hypot(e.x - p.x, e.y - p.y) > R + e.def.radius) continue;
      applyPoison(e.status, dps, EXPIRED_MILK.duration, now);
    }
  }
}
