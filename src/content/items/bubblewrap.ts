import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'bubblewrap', kind: 'passive', sets: ['checkout'], shape: '3x1', price: 10,
  tune: { armor: [1, 2, 3], invuln: 0.25 }, // flat damage soaked per hit = the tier (also above ★3: Gold Star's ★4 soaks 4); extra i-frames in seconds
  text: {
    en: { name: 'Bubble Wrap', blurb: 'Pop-proof padding for your cart.', rules: 'Take {armor} less damage from every hit (minimum 1) and +{invuln|s} invulnerability after being hit (does not stack).' },
    de: { name: 'Luftpolsterfolie', blurb: 'Platzsichere Polsterung für deinen Wagen.', rules: 'Nimm {armor} Schaden weniger pro Treffer (mindestens 1) und +{invuln|s} Unverwundbarkeit nach einem Treffer (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Armor', de: 'Rüstung' }, key: 'armor' }],
  build: {
    // `Build.armor` / `Build.invulnBonus` are no longer read at runtime (the hook below reads the tune); they stay for the golden snapshots.
    phase: 'final',
    player(b, c) { const t = c.tune(); b.armor = t.armor; b.invulnBonus = t.invuln; },
  },
  hooks: {
    // Runs in hurtPlayer after the i-frame / guard checks, before the hp is taken: the armor used to be applied in `run.damagePlayer`
    // (`max(1, amount - armor)`), the i-frame bonus in hurtPlayer itself. Every hit on the goblin goes through hurtPlayer.
    onPlayerHit(ev, _ctx, c) {
      const t = c.tune();
      ev.dmg = Math.max(1, ev.dmg - t.armor);
      ev.invuln += t.invuln;
    },
  },
});
