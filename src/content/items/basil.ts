import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Grows with use: every kill by an adjacent weapon counts on the instance (`ItemInstance.kills`, written by the onKill hook, so it survives the aisles
// and dies with the item when sold). The damage bonus is read when the cart is compiled, i.e. it grows between aisles, not mid-fight.
export default defineItem({
  id: Item.basil, kind: 'passive', sets: [Set.kitchen], shape: '1x1', price: 10,
  age: 'cart',
  tune: { perStep: [0.02, 0.03, 0.04], step: 25 },
  text: {
    en: { name: 'Potted Basil', blurb: 'Talk to it. It listens. Mostly.', rules: 'Weapons touching it gain {perStep|+pct} damage per {step|int} kills they make, with no cap. The count stays on the plant and is lost if you sell it.' },
    de: { name: 'Basilikumtopf', blurb: 'Red mit ihm. Er hört zu. Meistens.', rules: 'Angrenzende Waffen erhalten {perStep|+pct} Schaden pro {step|int} Kills, die sie erzielen, ohne Obergrenze. Der Zähler bleibt an der Pflanze und geht beim Verkauf verloren.' },
  },
  rows: [{ label: { en: 'Damage / 25 kills', de: 'Schaden / 25 Kills' }, key: 'perStep', fmt: '+pct' }],
  build: {
    phase: 'global-mod', order: 30,
    weapon(w, c) {
      const { step } = c.tune();
      for (const n of c.touching(w)) w.damage *= 1 + c.tuneOf(Item.basil, n.tier).perStep * Math.floor((n.instance.kills ?? 0) / step);
    },
  },
  hooks: {
    onKill(ev, _ctx, c) {
      const uid = ev.hit?.stats?.uid;
      if (uid) for (const p of c.touching(uid)) p.kills = (p.kills ?? 0) + 1;
    },
  },
});
