import { defineCombo } from '../../engine/define';

// Spray Bottle + Expired Milk + Desk Fan: every enemy a spray hits is poisoned (refreshes, never stacks). Applied from the cone's `hits`
// after the spray's damage.
export default defineCombo({
  id: 'sourMist', requires: ['spray', 'expiredmilk', 'fan'],
  tune: { dps: 4, duration: 3 },
  text: {
    en: {
      name: 'Sour Mist', short: 'Spray poisons ({dps|ps})',
      summary: 'Spray Bottle touching Expired Milk AND a Desk Fan: a curdled cloud.',
      detail: 'Spray hits poison enemies for {dps} damage/s for {duration|s} (refreshes, never stacks).',
    },
    de: {
      name: 'Sauernebel', short: 'Sprühstoß vergiftet ({dps|ps})',
      summary: 'Sprühflasche berührt Abgelaufene Milch UND Tischventilator: eine geronnene Wolke.',
      detail: 'Sprühtreffer vergiften Gegner für {dps} Schaden/s über {duration|s} (erneuert sich, stapelt sich nie).',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune();
      for (const e of ev.hits) ctx.poison(e, t.dps, t.duration);
    },
  },
});
