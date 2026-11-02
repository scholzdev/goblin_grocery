import { expect, test } from 'vitest';
import { computeBuild } from '../src/systems/synergies';
import { cart } from './cart';
import { RECIPES } from '../src/data/recipes';
import { contentComboTune, contentTune } from '../src/engine/registry';
import { recipeT } from '../src/i18n/data';
import { ITEMS, PLAYER } from '../src/data/items';
import type { ItemTypeId, RecipeId, WeaponStats } from '../src/types';

// Combo balance guard: every combo, built alone in an empty cart, must land within a band around the
// median "pack DPS". Set BALANCE_OUT=<file> to dump the ranking (used for the strongest-combo report).

/** single = one target; crowd = pack of 5 (3 inside any arc/line, all inside pulse/aura radius). */
export function comboDps(w: WeaponStats, shoveCd: number): { single: number; crowd: number } {
  const per = w.damage * (1 + w.critChance) * (1 + w.echo);
  const burn = w.burn ? w.burn.dps : 0;
  const r = 1 / w.cooldown;
  let single = 0, crowd = 0, burnS = 0, burnC = 0;
  switch (w.pattern) {
    case 'toast': burnS = burn; burnC = burn * Math.min(5, w.count); single = per * (1 + (w.count - 1) * 0.3) * r + burnS; crowd = per * Math.min(5, w.count * (1 + w.pierce)) * r + burnC; break;
    case 'burst': single = per * w.count * r; crowd = per * w.count * Math.min(3, 1 + w.pierce) * r + (w.recipes.includes('nailstorm') ? per * w.count * r * 0.5 : 0); break;
    case 'sweep': single = per * w.count * r; crowd = per * w.count * 3 * r; break;
    case 'pulse': case 'aura': single = per * r; crowd = per * 5 * r; break;
    case 'zap': single = per * r; crowd = (per * 3 + per * 0.6 * w.chain) * r; break;
    case 'ricochet': single = per * w.count * r; crowd = per * w.count * Math.min(5, 1 + w.bounces + w.pierce) * r; break;
    case 'puddle': single = (w.damage / w.tick) * (1 + w.critChance) + burn; crowd = single * 3; break;
    case 'cone': single = per * w.count * r; crowd = per * w.count * (w.arcDeg >= 110 ? 5 : 3) * r; break;
    case 'mortar': single = per * w.count * r + burn; crowd = per * w.count * 4 * r + (w.recipes.includes('pressurePoint') ? burn * 3 : 0); break;
    case 'popcorn': single = per * w.count * r; crowd = single; break; // a kernel per random target
    case 'laser': single = per * r; crowd = per * 3 * r; break;
    case 'tomato': { // one target per throw, but it prefers unpoisoned groceries: the pack ends up poisoned, plus the Fuel burn of the last few throws
      const t = contentTune('tomato', w.tier), poison = (t.dps * w.damage) / t.damage;
      burnS = burn; burnC = w.burn ? burn * Math.min(5, w.burn.duration * r) : 0;
      single = per * r + poison + burnS; crowd = per * r + poison * 5 + burnC; break;
    }
  }
  if (w.recipes.includes('expressCheckout')) {
    const every = Math.max(contentComboTune('expressCheckout').icd, shoveCd);
    single += per / every; crowd += (per * 3) / every;
  }
  // Behaviour-only combos: rough approximations so they are not scored as zero gain.
  const has = (id: RecipeId) => w.recipes.includes(id);
  if (has('potSlam')) { const every = shoveCd; single += per / every; crowd += (per * 4) / every; } // one pot blast per dash
  if (has('fiveAlarm')) { // +60% on the ~70% of hits that land on burning enemies
    const k = (contentComboTune('fiveAlarm').vsBurning - 1) * 0.7;
    single += (single - burnS) * k; crowd += (crowd - burnC) * k;
  }
  if (has('sizzlingSkillet')) { single += contentComboTune('sizzlingSkillet').dps; crowd += contentComboTune('sizzlingSkillet').dps * 3; }
  if (has('reheat')) { single += contentComboTune('reheat').dps; crowd += contentComboTune('reheat').dps * 3; }
  if (has('staticCling')) { single += per * contentComboTune('staticCling').damageMult * r; crowd += per * contentComboTune('staticCling').damageMult * 3 * r; }
  if (has('confettiCannon')) { single += contentComboTune('confettiCannon').damageMult * per * w.count * r; crowd += contentComboTune('confettiCannon').damageMult * per * 2 * w.bounces * w.count * r; }
  if (has('shrapnel')) { const x = contentComboTune('shrapnel').count * contentComboTune('shrapnel').damageMult * w.damage * 0.5 * r; single += x; crowd += x; }
  if (has('fireworksShow')) { const k = contentComboTune('fireworksShow'); single += k.count * k.damageMult * w.damage * 0.3 * r; crowd += k.count * k.damageMult * w.damage * 1.5 * r; } // ring blasts mostly miss one target, ~1.5 hit a pack
  if (has('kettleCorn')) { const k = contentComboTune('kettleCorn'), x = k.count * k.damage * w.count * r * 0.4; single += x; crowd += x; } // ~40% of volleys kill, each kill scatters kernels
  if (has('freshBread')) crowd *= 2; // one extra pierce roughly doubles the pack hits
  if (has('liveWire')) { const k = contentComboTune('liveWire'); single += (w.damage * k.damageMult * k.targets) / k.every * 0.3; crowd += (w.damage * k.damageMult * k.targets) / k.every * 0.8; } // zaps need Wet targets that just stood in a puddle
  if (has('thunderstorm')) { const k = contentComboTune('thunderstorm'); single += (w.damage * k.damageMult) / (k.every * w.cooldown) * 0.5; crowd += (w.damage * k.damageMult * k.targets) / (k.every * w.cooldown) * 0.7; } // every 3rd blast, only already-Wet targets
  if (has('slushie')) { single *= 1.05; crowd *= 1.25; } // slow ramp and a freeze: crowd-control value
  if (has('frostbiteNails')) crowd *= 1.15; // crowd-control value
  if (has('smoothieShield')) crowd *= 1.2;  // defensive value
  if (has('blackIce')) crowd *= 1.2;        // crowd-control value
  if (has('sourMist')) { single += contentComboTune('sourMist').dps; crowd += contentComboTune('sourMist').dps * 3; }
  if (has('bagIt')) { const x = (contentComboTune('bagIt').dmgPerCharge * 3) / shoveCd; single += x; crowd += x * 3; } // ~3 charges per dash
  if (has('sparksFly')) { const k = contentComboTune('sparksFly'); crowd += per * (k.chainMult - 0.6) * k.chain * r + per * k.chain * k.stunChance * 0.3 * r; } // chain at 50% not 60% + stun value
  if (has('rayGun')) { const x = per * w.count * r * contentComboTune('rayGun').splashMult * 3; crowd += x; } // splash on ~3 neighbours (no pierce)
  if (w.type === 'leafblower') { const x = 8 * w.tier; single += x * 0.3 * r; crowd += x * 3 * 0.5 * r; } // slam: ~half of the blown pack hits a wall or prop
  if (has('tailwind')) crowd *= 1.1;        // mobility value
  if (has('smashBank')) crowd *= 1.1;       // economy value
  // Mark (x1.2 damage taken): Bloody Mary marks each tomato target, Sticky Mop everything entering the puddle, Magnetic Fizz each bounce target.
  if (has('bloodyMary')) { single *= 1.2; crowd *= 1.15; }
  if (has('stickyMop')) { single *= 1.2; crowd *= 1.2; }
  if (has('magneticFizz')) crowd *= 1.15;
  if (has('salsaSplash')) crowd += contentComboTune('salsaSplash').dps * 2; // ~2 neighbours not yet poisoned by the throws themselves
  if (has('scaldingClean')) { single += contentComboTune('scaldingClean').dps; crowd += contentComboTune('scaldingClean').dps * 3; }
  if (has('leafPile')) { single += burn; crowd += burn * 5; } // the cone model has no burn; the spread puts the Fuel burn on the whole pack
  if (has('snowBlower')) { const k = contentTune('snowcone', 1), x = (k.damage / k.tick) * Math.min(1, k.duration * r / 3); single += x; crowd += x * 3; } // a snow-cone puddle at the cone's end
  if (has('sporeStorm')) { const k = contentTune('moldybread', 1); single += k.poison; crowd += k.poison * 3; } // a poison cloud at the cone's end
  if (has('coldDiscount')) crowd *= contentComboTune('coldDiscount').rangeMult;   // a wider puddle covers more of the pack
  if (has('frozenKernels')) crowd *= contentComboTune('frozenKernels').rangeMult;
  if (has('neonSmoothie')) crowd *= 1.1;    // reach value: the aura model already hits the whole pack
  if ((has('chillKernels') || has('thickSmoothie')) && w.slow) crowd *= 1 + w.slow.pct / 2; // slow: crowd-control value, by its strength
  if (has('polarArc') || has('airRaid')) crowd *= 1.15;           // stun: crowd-control value
  if (has('tomatoHelmet') || has('sodaShield') || has('frostArmor') || has('foamGuard') || has('blanketBarrage')) crowd *= 1.2; // defensive value
  if (has('tomatoToll')) crowd *= 1.1;      // economy value
  if (has('powerSurge')) { const k = 1 + contentComboTune('powerSurge').damageMult; single *= k; crowd *= k; }
  if (has('priceCheck')) { single = single * contentComboTune('priceCheck').damageMult + 0.3 * 20; crowd = crowd * contentComboTune('priceCheck').damageMult + 0.3 * 20; }
  return { single, crowd };
}

// Combos whose value is a status against armor (Shred), not a damage rate: the rate model above cannot score them (they change no weapon stat).
const STATUS_ONLY: readonly RecipeId[] = ['crackOpen'];

test('no combo is far stronger or weaker than the rest', async () => {
  const rows = (Object.keys(RECIPES) as RecipeId[]).filter((id) => RECIPES[id].weapon && !STATUS_ONLY.includes(id)).map((id) => {
    const r = RECIPES[id];
    if (!r.weapon) throw new Error('cart combo');
    const base = computeBuild(cart(r.weapon, []));
    const full = computeBuild(cart(r.weapon, r.supports));
    expect(full.recipes.map((x) => x.id)).toContain(id);
    expect(cart(r.weapon, r.supports).placed.map((p) => p.type).sort()).toEqual([r.weapon, ...r.supports].sort());
    const b = comboDps(base.weapons[0], PLAYER.shove.cooldown), f = comboDps(full.weapons[0], full.shoveCooldown);
    return { combo: recipeT(id).name, items: [r.weapon, ...r.supports].join('+'), single: +f.single.toFixed(1), crowd: +f.crowd.toFixed(1), crowdGain: `${Math.round((f.crowd / b.crowd - 1) * 100)}%` };
  }).sort((a, b) => b.crowd - a.crowd);
  // Runtime-only lookups: the project ships no Node typings.
  const out = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.BALANCE_OUT;
  if (out) {
    const fsMod = 'node:fs';
    (await import(/* @vite-ignore */ fsMod)).writeFileSync(out, JSON.stringify(rows));
  }
  const median = [...rows].sort((a, b) => a.crowd - b.crowd)[Math.floor(rows.length / 2)].crowd;
  // Combos built only from legendaries (rare, late, two shop slots of luck) may sit higher: 2.2× instead of 1.8×.
  // 1.8× (was 1.7×) since the roster grew to 66 combos: the many new support combos sit below the old median and pulled it down.
  const allLegendary = (items: string) => items.split('+').every((t) => ITEMS[t as ItemTypeId].legendary);
  for (const r of rows) {
    expect(r.crowd, `${r.combo} too strong`).toBeLessThanOrEqual(median * (allLegendary(r.items) ? 2.2 : 1.8));
    expect(r.crowd, `${r.combo} too weak`).toBeGreaterThanOrEqual(median * 0.5);
  }
});
