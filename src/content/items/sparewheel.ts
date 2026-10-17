import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'sparewheel', kind: 'passive', sets: ['tools'], shape: '1x1', price: 10,
  tune: { window: [1, 1.5, 2] }, // seconds after a normal dash in which one more dash is free (1 s x TIER.mult)
  text: {
    en: { name: 'Spare Wheel', blurb: 'Two dashes for the price of one.', rules: 'After a dash, one more dash within {window|s} is free: it skips the cooldown (does not stack).' },
    de: { name: 'Ersatzrad', blurb: 'Zwei Dashes zum Preis von einem.', rules: 'Nach einem Dash ist ein weiterer Dash innerhalb von {window|s} gratis: er überspringt die Abklingzeit (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Free dash window', de: 'Gratis-Dash-Fenster' }, key: 'window', fmt: 's' }],
  hooks: {
    // The scene resets `chainT` to 0 on every dash (a chained dash uses the window up, a normal one closes the old window), then emits
    // this. A normal dash opens a new window; a chained dash (`ev.chained`) does not open another one, so the chain is one free dash long.
    onDashStart(ev, ctx, c) {
      if (!ev.chained) ctx.player.chainT = c.tune().window;
    },
  },
});
