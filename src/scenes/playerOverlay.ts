import Phaser from 'phaser';
import { contentTune } from '../engine/registry';
import { store } from '../state/store';
import { DEPTH } from './fx';
import type { ArenaScene } from './ArenaScene';

/**
 * The two things drawn on and around the goblin that belong to no weapon (the combo rules are combo hooks):
 * - the status text above the goblin ("SUGAR ###", "BAG x3"): hooks write lines with `ctx.setLine`, this shows them while the goblin fights;
 * - the Expired Milk cloud under it (drawing only: the poison is the item's `onTick` hook).
 */
export class PlayerOverlay {
  private lines = new Map<string, { text: string; order: number }>();
  private label: Phaser.GameObjects.Text;
  private cloud: Phaser.GameObjects.Graphics;

  constructor(private scene: ArenaScene) {
    this.label = scene.add.text(0, 0, '', { fontFamily: '"Luckiest Guy", "Arial Black", sans-serif', fontSize: '20px', color: '#FFF2D5', stroke: '#30203F', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5, 1).setDepth(DEPTH.bars + 2).setVisible(false);
    this.cloud = scene.add.graphics().setDepth(DEPTH.decal + 1);
  }

  /** One line of the text (see `RuntimeCtx.setLine`): top to bottom by `order`, then by first appearance. `null` removes it. */
  setLine(id: string, text: string | null, order = 0): void {
    if (text === null) this.lines.delete(id); else this.lines.set(id, { text, order: this.lines.get(id)?.order ?? order });
  }

  update(dt: number, now: number, active: boolean): void {
    const sc = this.scene, p = sc.player, dps = store.state?.build?.stinkDps ?? 0;
    const text = active ? [...this.lines.values()].sort((a, b) => a.order - b.order).map((l) => l.text) : [];
    this.label.setVisible(text.length > 0).setText(text.join('\n')).setPosition(p.x, p.y - 110);

    this.cloud.clear();
    if (!active || dps <= 0) return;
    // Only the cloud is drawn here; the poison itself is Expired Milk's onTick hook (content/items/expiredmilk.ts).
    const R = contentTune('expiredmilk', 1).radius;
    this.cloud.fillStyle(0x8fcb57, 0.1 + 0.04 * Math.sin(now * 2)).fillEllipse(p.x, p.y, R * 2, R * 1.24);
    if (Math.random() < dt * 4) sc.fx.spark(p.x + Phaser.Math.Between(-R, R) * 0.7, p.y - Phaser.Math.Between(0, 40), 1, 0x8fcb57);
  }
}
