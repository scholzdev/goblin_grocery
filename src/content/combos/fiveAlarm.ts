import { defineCombo } from '../../engine/define';

// Toaster + Hot Sauce + Fuel Can: toast hits burning enemies for x`vsBurning`. A `modifyDamage` hook, so it multiplies before the engine's
// mark rule and the crit roll (Five-Alarm, then mark, then crit; `order` 10 is the slot docs/item-hooks-refactor.md §4c reserved).
export default defineCombo({
  id: 'fiveAlarm', requires: ['toaster', 'hotsauce', 'fuel'],
  tune: { vsBurning: 1.8 },
  text: {
    en: {
      name: 'Five-Alarm Toast', short: '+{vsBurning|pctup}% vs burning',
      summary: 'Toaster touching Hot Sauce AND a Fuel Can: toast scorches burning groceries.',
      detail: 'Toast deals +{vsBurning|pctup}% damage to enemies that are already on fire.',
    },
    de: {
      name: 'Fünf-Alarm-Toast', short: '+{vsBurning|pctup}% gegen Brennende',
      summary: 'Toaster berührt Scharfe Soße UND Benzinkanister: Toast versengt brennende Gegner.',
      detail: 'Toast macht +{vsBurning|pctup}% Schaden an Gegnern, die bereits brennen.',
    },
  },
  hooks: {
    order: 10,
    modifyDamage(hit, _ctx, c) {
      const s = hit.stats;
      if (s && c.touches(s.uid) && s.pattern === 'toast' && hit.enemy.status.burnUntil > hit.now) hit.dmg *= c.tune().vsBurning;
    },
  },
});
