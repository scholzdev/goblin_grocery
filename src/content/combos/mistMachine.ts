import { defineCombo } from '../../engine/define';

// Spray Bottle + Desk Fan: a huge misting cone. It replaces the Fan bonus (fan.ts skips itself when this combo matches), so the arc is set
// to `arcDeg` plus whatever Duct Tape added.
export default defineCombo({
  id: 'mistMachine', requires: ['spray', 'fan'],
  tune: { arcDeg: 120, rangeMult: 1.4 },
  text: {
    en: {
      name: 'Mist Machine', short: 'Huge {arcDeg|deg} spray cone',
      summary: 'Spray Bottle touching a Desk Fan: a huge misting cone.',
      detail: 'Spray cone widens to {arcDeg|deg} and reaches {rangeMult|pctup}% farther. (Fan speed/range bonus does not apply to sprays — this replaces it.)',
    },
    de: {
      name: 'Nebelmaschine', short: 'Riesiger {arcDeg|deg}-Sprühkegel',
      summary: 'Sprühflasche berührt Tischventilator: ein riesiger Nebelkegel.',
      detail: 'Der Sprühkegel wird {arcDeg|deg} breit und reicht {rangeMult|pctup}% weiter. (Der Ventilator-Bonus auf Tempo/Reichweite gilt nicht für Sprühstöße, dies ersetzt ihn.)',
    },
  },
  suppresses: ['fan'],
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.arcDeg += t.arcDeg - c.def(w.type).weapon!.arcDeg; w.range *= t.rangeMult;
    },
  },
});
