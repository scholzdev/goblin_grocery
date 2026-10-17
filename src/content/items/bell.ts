import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.bell, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 7,
  unlock: 'starting',
  tune: { cooldown: [0.5, 0.75, 1] }, // seconds off the dash (shove) cooldown per ★ (0.5 base x TIER.mult)
  text: {
    en: { name: 'Shopping Bell', blurb: 'Ding! Dash more often.', rules: 'Dash cooldown {cooldown|−s} (does not stack). Enables Express Checkout next to a Frying Pan.' },
    de: { name: 'Einkaufsklingel', blurb: 'Kling! Öfter dashen.', rules: 'Dash-Abklingzeit {cooldown|−s} (stapelt sich nicht). Schaltet Schnellkasse neben einer Bratpfanne frei.' },
  },
  rows: [{ label: { en: 'Dash cooldown', de: 'Dash-Abklingzeit' }, key: 'cooldown', fmt: '−s' }],
  build: {
    // Player-only. Subtracts from the base cooldown (3 s) on top of the perk (Night Shift's -1 s); linear in the tier, so Gold Star's ★4 is -1.25 s.
    phase: 'final',
    player(b, c) { b.shoveCooldown -= c.tune().cooldown; },
  },
});
