import { defineCombo } from '../../engine/define';

// Blender + Bubble Wrap: enemy projectiles inside the blade ring are shredded on every blender tick.
export default defineCombo({
  id: 'smoothieShield', requires: ['blender', 'bubblewrap'],
  text: {
    en: {
      name: 'Smoothie Shield', short: 'Blades eat bullets',
      summary: 'Blender touching Bubble Wrap: the blades shred enemy projectiles.',
      detail: 'Bubbles and receipts that enter the blade ring are destroyed.',
    },
    de: {
      name: 'Smoothie-Schild', short: 'Klingen fressen Geschosse',
      summary: 'Mixer berührt Luftpolsterfolie: die Klingen schreddern gegnerische Projektile.',
      detail: 'Blasen und Kassenbons, die in den Klingenring geraten, werden zerstört.',
    },
  },
  hooks: {
    'pattern:aura'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      for (const shot of ctx.enemyShots()) {
        if (!shot.active || (shot.x - ev.x) ** 2 + (shot.y - ev.y) ** 2 > ev.range * ev.range) continue;
        ctx.fx.spark(shot.x, shot.y - 20, 4, 0xcff3ff);
        ctx.killShot(shot);
      }
    },
  },
});
