import { defineEnemy } from '../../engine/define';

// Armor never soaks more than 70% of a hit: the damage after armor is at least `minShare` of it.
export default defineEnemy({
  id: 'beans', behavior: 'chase', scale: 0.78, hpBar: true,
  stats: {
    hp: 40, speed: 52, contactDamage: 5, coins: 2, radius: 20,
    armor: 3, knockbackResist: 0.4,
  },
  tune: { minShare: 0.3 },
  text: {
    en: { name: 'Canned Beans', blurb: 'Dented, dense and armored: direct hits lose {armor} damage. Burn, puddles and auras ignore the tin.' },
    de: { name: 'Dosenbohnen', blurb: 'Verbeult, dicht und gepanzert: direkte Treffer verlieren {armor} Schaden. Brand, Pfützen und Auren ignorieren die Dose.' },
  },
});
