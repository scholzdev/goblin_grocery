import { expect, test } from 'vitest';
import { computeBuild } from '../src/systems/synergies';
import { cart } from './cart';
import { RECIPES } from '../src/data/recipes';
import { contentComboTune } from '../src/engine/registry';
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
    case 'burst': single = per * w.count * r; crowd = per * w.count * Math.min(3, 1 + w.pierce) * r + (w.homing ? per * w.count * r * 0.5 : 0); break;
    case 'sweep': single = per * w.count * r; crowd = per * w.count * 3 * r; break;
    case 'pulse': case 'aura': single = per * r; crowd = per * 5 * r; break;
    case 'zap': single = per * r; crowd = (per * 3 + per * 0.6 * w.chain) * r; break;
    case 'ricochet': single = per * w.count * r; crowd = per * w.count * Math.min(5, 1 + w.bounces + w.pierce) * r; break;
    case 'puddle': single = (w.damage / w.tick) * (1 + w.critChance) + burn; crowd = single * 3; break;
    case 'cone': single = per * w.count * r; crowd = per * w.count * (w.arcDeg >= 110 ? 5 : 3) * r; break;
    case 'mortar': single = per * w.count * r + burn; crowd = per * w.count * 4 * r + (w.firePool ? burn * 3 : 0); break;
    case 'laser': single = per * r; crowd = per * 3 * r; break;
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
  if (has('powerSurge')) { const k = 1 + contentComboTune('powerSurge').damageMult; single *= k; crowd *= k; }
  if (has('priceCheck')) { single = single * contentComboTune('priceCheck').damageMult + 0.3 * 20; crowd = crowd * contentComboTune('priceCheck').damageMult + 0.3 * 20; }
  return { single, crowd };
}

test('no combo is far stronger or weaker than the rest', async () => {
  const rows = (Object.keys(RECIPES) as RecipeId[]).filter((id) => RECIPES[id].weapon).map((id) => {
    const r = RECIPES[id];
    if (!r.weapon) throw new Error('cart combo');
    const base = computeBuild(cart(r.weapon, []));
    const full = computeBuild(cart(r.weapon, r.supports));
    expect(full.recipes.map((x) => x.id)).toContain(id);
    expect(cart(r.weapon, r.supports).placed.map((p) => p.type).sort()).toEqual([r.weapon, ...r.supports].sort());
    const b = comboDps(base.weapons[0], PLAYER.shove.cooldown), f = comboDps(full.weapons[0], full.shoveCooldown);
    return { combo: r.name, items: [r.weapon, ...r.supports].join('+'), single: +f.single.toFixed(1), crowd: +f.crowd.toFixed(1), crowdGain: `${Math.round((f.crowd / b.crowd - 1) * 100)}%` };
  }).sort((a, b) => b.crowd - a.crowd);
  // Runtime-only lookups: the project ships no Node typings.
  const out = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.BALANCE_OUT;
  if (out) {
    const fsMod = 'node:fs';
    (await import(/* @vite-ignore */ fsMod)).writeFileSync(out, JSON.stringify(rows));
  }
  const median = [...rows].sort((a, b) => a.crowd - b.crowd)[Math.floor(rows.length / 2)].crowd;
  // Combos built only from legendaries (rare, late, two shop slots of luck) may sit higher: 2.2× instead of 1.7×.
  const allLegendary = (items: string) => items.split('+').every((t) => ITEMS[t as ItemTypeId].legendary);
  for (const r of rows) {
    expect(r.crowd, `${r.combo} too strong`).toBeLessThanOrEqual(median * (allLegendary(r.items) ? 2.2 : 1.7));
    expect(r.crowd, `${r.combo} too weak`).toBeGreaterThanOrEqual(median * 0.5);
  }
});
