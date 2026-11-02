import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Leaf Blower + Snow Cone Machine (two weapons): every blast drops one of the Snow Cone's slush puddles at the end of its cone (`ctx.spawnPuddle`: the
// snow cone's own look, slow, Wet and damage). The puddles count toward the shared cap of 14.
export default defineCombo({
  id: Combo.snowBlower, requires: [Item.leafblower, Item.snowcone],
  text: {
    en: {
      name: 'Snow Blower', short: 'Blasts drop slush puddles',
      summary: 'Leaf Blower touching a Snow Cone Machine: the gust carries the slush.',
      detail: 'Every blast drops a Snow Cone slush puddle where the cone ends.',
    },
    de: {
      name: 'Schneefräse', short: 'Böen lassen Matschpfützen fallen',
      summary: 'Laubbläser berührt Slush-Maschine: der Windstoß trägt den Matsch mit.',
      detail: 'Jede Böe lässt am Ende des Kegels eine Slush-Pfütze der Slush-Maschine fallen.',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const r = ctx.build.recipes.find((x) => x.id === Combo.snowBlower && x.weaponUid === ev.stats.uid);
      const snow = ctx.build.weapons.find((w) => w.type === Item.snowcone && r?.supportUids.includes(w.uid));
      if (snow) ctx.spawnPuddle(snow.uid, ev.x + Math.cos(ev.angle) * ev.stats.range, ev.y + Math.sin(ev.angle) * ev.stats.range);
    },
  },
});
