import { defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

export default defineEnemy({
  id: Enemy.slice, behavior: 'chase', scale: 0.5, hpBar: true,
  stats: { hp: 5, speed: 95, contactDamage: 3, coins: 0, radius: 14 },
  text: {
    en: { name: 'Melon Slice', blurb: 'A juicy little leftover. Fast, fragile, worth no coins.' },
    de: { name: 'Melonenscheibe', blurb: 'Ein saftiger kleiner Rest. Flink, zerbrechlich, keine Münzen wert.' },
  },
});
