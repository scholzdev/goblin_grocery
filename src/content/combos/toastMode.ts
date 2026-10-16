import { defineCombo } from '../../engine/define';

// Toaster + Desk Fan + Fuel Can: three flaming toasts per shot. The Fuel burn comes from the module phase; this only reshapes the volley.
// The flame trail and the amber hit sparks are drawn by the toast pattern / damageEnemy from `recipes` (phase 7).
export default defineCombo({
  id: 'toastMode', requires: ['toaster', 'fan', 'fuel'],
  tune: { count: 3, damageMult: 0.75, spreadDeg: 22 },
  text: {
    en: {
      name: 'Toast Mode', short: '{count} flaming toasts per shot',
      summary: 'Toaster touching a Desk Fan AND a Fuel Can: flaming three-toast spread.',
      detail: 'Fires {count} toasts in a spread. Each deals {damageMult|pct} damage and sets enemies on fire (burn does not stack). Fan speed and range still apply.',
    },
    de: {
      name: 'Toast-Modus', short: '{count} flammende Toasts pro Schuss',
      summary: 'Toaster berührt Tischventilator UND Benzinkanister: flammender Dreifach-Toast-Fächer.',
      detail: 'Feuert {count} Toasts im Fächer. Jeder macht {damageMult|pct} Schaden und setzt Gegner in Brand (Brand stapelt sich nicht). Ventilator-Tempo und -Reichweite gelten weiterhin.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.count = t.count; w.damage *= t.damageMult; w.spreadDeg = t.spreadDeg;
    },
  },
});
