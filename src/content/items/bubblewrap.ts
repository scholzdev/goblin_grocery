import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.bubblewrap, kind: 'passive', sets: [Set.checkout], shape: '3x1', price: 10,
  tune: { armor: [1, 2, 3], minDamage: 1, invuln: 0.25 }, // flat damage soaked per hit = the tier (also above ★3: Gold Star's ★4 soaks 4), but a hit always deals `minDamage`; extra i-frames in seconds
  text: {
    en: { name: 'Bubble Wrap', blurb: 'Pop-proof padding for your cart.', rules: 'Take {armor} less damage from every hit (minimum {minDamage}) and +{invuln|s} invulnerability after being hit (does not stack).' },
    de: { name: 'Luftpolsterfolie', blurb: 'Platzsichere Polsterung für deinen Wagen.', rules: 'Nimm {armor} Schaden weniger pro Treffer (mindestens {minDamage}) und +{invuln|s} Unverwundbarkeit nach einem Treffer (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Armor', de: 'Rüstung' }, key: 'armor' }],
  hooks: {
    // Runs in hurtPlayer after the i-frame / guard checks, before the hp is taken: the armor used to be applied in `run.damagePlayer`
    // (`max(1, amount - armor)`), the i-frame bonus in hurtPlayer itself. Every hit on the goblin goes through hurtPlayer.
    onPlayerHit(ev, _ctx, c) {
      const t = c.tune();
      ev.dmg = Math.max(t.minDamage, ev.dmg - t.armor);
      ev.invuln += t.invuln;
    },
  },
});
