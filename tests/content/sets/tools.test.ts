import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import tools from '../../../src/content/sets/tools';
import { contentItems, contentSet, contentSetTune, contentTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { arena, at, far, full } from '../helpers';
import { draws, expectSetText, seedWhere } from './helpers';

afterEach(() => setLang('en'));

const GUN = at('nailgun'); // a tools weapon
// Tools members that touch nothing and change neither cooldowns nor the dash: Magnet, Spare Wheel, Tin Foil Hat.
const MEMBERS = [far('magnet'), far('sparewheel'), far('tinfoilhat')];
const cart = (n: number) => [GUN, ...MEMBERS.slice(0, n)];
const baseCooldown = ITEMS.nailgun.weapon!.cooldown * TIER.weaponCooldown(1);

describe('Tools set: thresholds', () => {
  it('2 / 3 / 4 distinct tools types give L1 / L2 / L3; the weapon alone is 1', () => {
    expect([0, 1, 2, 3].map((n) => full(cart(n)).sets.tools)).toEqual([0, 1, 2, 3]);
  });

  it('no bonus below the threshold: base cooldown, base dash (6 damage, no stun)', () => {
    const b = full(cart(0));
    expect(b.weapons[0].cooldown).toBe(baseCooldown);
    expect(b.shoveDamage).toBe(PLAYER.shove.damage);
    expect(b.shoveStun).toBe(0);
  });

  it('L1 +8% attack rate (cooldown / 1.08) for every weapon; the dash is untouched', () => {
    const b = full(cart(1));
    expect(b.weapons[0].cooldown).toBeCloseTo(baseCooldown / 1.08, 12);
    expect(b.shoveDamage).toBe(PLAYER.shove.damage);
    expect(b.shoveStun).toBe(0);
  });

  it('L2 doubles the dash damage and stuns 0.3 s; the cooldown bonus stays', () => {
    const b = full(cart(2));
    expect(b.weapons[0].cooldown).toBeCloseTo(baseCooldown / 1.08, 12);
    expect(b.shoveDamage).toBe(PLAYER.shove.damage * 2);
    expect(b.shoveStun).toBe(0.3);
  });

  it('L3 replaces the numbers: cooldown / 1.15, dash x3, stun 0.45 s', () => {
    const b = full(cart(3));
    expect(b.weapons[0].cooldown).toBeCloseTo(baseCooldown / 1.15, 12);
    expect(b.shoveDamage).toBe(PLAYER.shove.damage * 3);
    expect(b.shoveStun).toBe(0.45);
  });

  it('applies to weapons of any family (a kitchen weapon in a Tools cart attacks faster too)', () => {
    const pan = at('pan'), plain = full([pan]).weapons[0].cooldown;
    expect(full([pan, ...MEMBERS.slice(0, 2)]).sets.tools).toBe(1); // two tools types, none of them the pan: L1
    expect(full([pan, ...MEMBERS.slice(0, 2)]).weapons[0].cooldown).toBeCloseTo(plain / 1.08, 12);
  });
});

// The dash multiplier multiplies the finished total, Running Boot's bonus and the perk included: (6 + boot + perk) x mult.
describe('Tools set: dash damage ordering', () => {
  const boot = contentTune('boot', 1).damage;

  it('multiplies Running Boot\'s bonus too (the legacy (6 + boot + perk) x mult)', () => {
    expect(full([GUN, far('magnet'), far('boot')]).shoveDamage).toBe((PLAYER.shove.damage + boot) * 2); // L2
    expect(full([GUN, far('magnet'), far('boot'), far('sparewheel')]).shoveDamage).toBe((PLAYER.shove.damage + boot) * 3); // L3
    expect(full([GUN, far('magnet'), far('boot', 3)]).shoveDamage).toBe((PLAYER.shove.damage + contentTune('boot', 3).damage) * 2);
  });

  it('multiplies the perk\'s dash damage as well', () => {
    expect(full([GUN, ...MEMBERS.slice(0, 2)], { shoveDamage: 2 }).shoveDamage).toBe((PLAYER.shove.damage + 2) * 2);
    expect(full([GUN, ...MEMBERS.slice(0, 2), far('boot')], { shoveDamage: 2 }).shoveDamage).toBe((PLAYER.shove.damage + boot + 2) * 3);
  });

  it('its player hook runs after every item\'s (their order is below 200, Expired Milk\'s curse is 100)', () => {
    const [dash] = tools.extraBuild!;
    expect(dash).toMatchObject({ phase: 'final', order: 200 });
    const itemOrders = contentItems().flatMap((c) => [c.build, ...(c.extraBuild ?? [])]).filter((b) => b?.player).map((b) => b!.order ?? 0);
    expect(Math.max(...itemOrders)).toBeLessThan(200);
  });
});

describe('Tools set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3)', () => {
    expect(contentSet('tools')).toBe(tools);
    expect(contentSetTune('tools', 1)).toEqual({ cooldownDiv: 1.08, shoveDamageMult: 2, shoveStun: 0.3 });
    expect(contentSetTune('tools', 2)).toEqual(contentSetTune('tools', 1));
    expect(contentSetTune('tools', 3)).toEqual({ cooldownDiv: 1.15, shoveDamageMult: 3, shoveStun: 0.45 });
  });

  it('runs its weapon hook at set order 30', () => {
    expect(tools.build).toMatchObject({ phase: 'set', order: 30 });
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('tools', {
      en: { name: 'Tools', bonus: ['All weapons +8% attack rate', 'Dash damage ×2, stuns 0.3 s', 'All weapons +15% attack rate; dash damage ×3, stuns 0.45 s'] },
      de: { name: 'Werkzeug', bonus: ['Alle Waffen +8 % Angriffstempo', 'Dash-Schaden ×2, betäubt 0,3 s', 'Alle Waffen +15 % Angriffstempo; Dash-Schaden ×3, betäubt 0,45 s'] },
    });
  });
});

// Runtime: `onDashHit`, once per enemy the dash hits (the scene emits it right after the shove damage). L2+ stuns it with a ring.
describe('Tools set: dash stun', () => {
  const dash = (cartSpecs: Parameters<typeof arena>[0], opts = {}) => {
    const a = arena(cartSpecs, { seed: 1, ...opts });
    const enemy = a.fake.spawnEnemy({ hp: 100, x: 30, y: 70 });
    a.fake.hooks.emit('onDashHit', { enemy, dx: 1, dy: 0, dmg: 6 });
    return { ...a, enemy };
  };

  it('stuns for the set\'s seconds with a ring at the enemy (L2 0.3 s, L3 0.45 s)', () => {
    for (const [n, seconds] of [[2, 0.3], [3, 0.45]] as const) {
      const { fake, enemy } = dash(cart(n));
      expect(fake.callsOf('stun')).toEqual([{ at: 0, kind: 'stun', enemy: enemy.id, seconds }]);
      expect(fake.callsOf('fx').find((c) => c.method === 'ring')?.args).toEqual(['fx_pulse', 30, 70, 70, 220, 0xf5bd45]);
    }
  });

  it('does nothing below L2, and draws no random numbers', () => {
    for (const n of [0, 1]) {
      const { fake } = dash(cart(n));
      expect(fake.calls).toEqual([]);
    }
    const { fake } = dash(cart(3));
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('runs after the item hooks of the same dash hit: Tip Jar\'s coin first, then the stun', () => {
    const seed = seedWhere((r) => r < 0.4);
    const { fake } = dash([GUN, ...MEMBERS.slice(0, 2), far('tipjar')], { seed });
    expect(fake.calls.map((c) => c.kind).filter((k) => k === 'dropCoin' || k === 'stun')).toEqual(['dropCoin', 'stun']);
  });

  it('the build field stays for the snapshots, the arena no longer reads it', () => {
    expect(full(cart(2)).shoveStun).toBe(0.3);
  });
});
