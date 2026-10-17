import { describe, expect, it } from 'vitest';
import crackOpen from '../../../src/content/combos/crackOpen';
import { SHRED } from '../../../src/engine/define';
import { contentComboTune } from '../../../src/engine/registry';
import { recipeT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { arena, at, bare, describeCombo, draws, partsOf, weaponOf } from './helpers';

describeCombo('crackOpen', crackOpen, ['Crack Open', 'Aufknacken']);

describe('Crack Open: build', () => {
  it('changes no weapon stat of its own (pierce, burst size)', () => {
    const w = weaponOf(partsOf(crackOpen)), plain = bare('nailgun');
    expect(w.recipes).toEqual(['crackOpen']);
    expect(w.pierce).toBe(plain.pierce);
    expect(w.count).toBe(plain.count);
  });
});

describe('Crack Open: text', () => {
  it('renders EN and DE from the tune', () => {
    expect(contentComboTune('crackOpen')).toEqual({ every: 3, stacks: 2, duration: SHRED.duration });
    expect(recipeT('crackOpen')).toMatchObject({ short: '3rd nail: +2 Shred', detail: 'Every 3rd nail that hits the same enemy applies 2 extra Shred stacks.' });
    try {
      setLang('de');
      expect(recipeT('crackOpen')).toMatchObject({ name: 'Aufknacken', short: '3. Nagel: +2 Aufreißen', detail: 'Jeder 3. Nagel, der denselben Gegner trifft, fügt 2 zusätzliche Stapel Aufreißen hinzu.' });
    } finally { setLang('en'); }
  });
});

describe('Crack Open: runtime', () => {
  const shotHit = (stats: ReturnType<typeof arena>['stats'], enemy: never) => ({ stats, enemy, shot: { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 1, damage: 3, stats, splash: null } as never });

  it('adds 2 Shred stacks on every 3rd nail that hits the same enemy, counted per enemy', () => {
    const { fake, stats } = arena(partsOf(crackOpen));
    const a = fake.spawnEnemy(), b = fake.spawnEnemy();
    const shreds = () => fake.callsOf('shred').map((c) => [c.enemy, c.stacks]);
    for (let i = 1; i <= 7; i++) fake.hooks.emit('pattern:shotHit', shotHit(stats, a as never));
    expect(shreds()).toEqual([[a.id, 2], [a.id, 2]]); // hits 3 and 6
    fake.hooks.emit('pattern:shotHit', shotHit(stats, b as never));
    expect(shreds()).toHaveLength(2);
    fake.hooks.emit('pattern:shotHit', shotHit(stats, a as never)); // a's 8th
    fake.hooks.emit('pattern:shotHit', shotHit(stats, a as never)); // a's 9th
    expect(shreds()).toEqual([[a.id, 2], [a.id, 2], [a.id, 2]]);
    expect(a.status.shredStacks).toBe(SHRED.cap); // 2 + 2 + 2, capped
  });

  it('keeps its own count: Frostbite Nails\' `nailHits` is never touched, and the other way round', () => {
    const { fake, stats } = arena(partsOf(crackOpen));
    const e = fake.spawnEnemy();
    for (let i = 0; i < 4; i++) fake.hooks.emit('pattern:shotHit', shotHit(stats, e as never));
    expect(e.nailHits).toBeUndefined();
    e.nailHits = 2; // a Frostbite count of 2 does not move the 3rd-nail trigger of Crack Open (4 hits so far, the 5th and 6th follow)
    fake.hooks.emit('pattern:shotHit', shotHit(stats, e as never));
    expect(fake.callsOf('shred')).toHaveLength(1);
    fake.hooks.emit('pattern:shotHit', shotHit(stats, e as never));
    expect(fake.callsOf('shred')).toHaveLength(2);
    expect(e.nailHits).toBe(2);
  });

  it('does not count a dead enemy, a non-burst weapon or a nail gun it does not touch', () => {
    const { fake, stats } = arena(partsOf(crackOpen));
    const dead = fake.spawnEnemy({ alive: false });
    for (let i = 0; i < 3; i++) fake.hooks.emit('pattern:shotHit', shotHit(stats, dead as never));
    const e = fake.spawnEnemy();
    for (let i = 0; i < 3; i++) fake.hooks.emit('pattern:shotHit', shotHit({ ...stats, pattern: 'toast' }, e as never));
    for (let i = 0; i < 3; i++) fake.hooks.emit('pattern:shotHit', shotHit({ ...stats, uid: 'other' }, e as never));
    expect(fake.callsOf('shred')).toEqual([]);
  });

  it('draws no random numbers, and its state starts fresh in a new arena', () => {
    const one = arena(partsOf(crackOpen), { seed: 3 }), two = arena(partsOf(crackOpen), { seed: 3 });
    const e = one.fake.spawnEnemy();
    for (let i = 0; i < 6; i++) one.fake.hooks.emit('pattern:shotHit', shotHit(one.stats, e as never));
    expect(one.fake.rng()).toBe(draws(3, 1)[0]);
    const f = two.fake.spawnEnemy();
    two.fake.hooks.emit('pattern:shotHit', shotHit(two.stats, f as never));
    expect(two.fake.callsOf('shred')).toEqual([]);
  });

  it('with the Can Opener\'s own roll on top (★3, always) the cap is reached within three nails', () => {
    const { fake, stats } = arena(partsOf(crackOpen).map((s) => (s.type === 'canopener' ? at('canopener', 3) : s)));
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 3, stats); fake.hit(e, 3, stats);
    for (let i = 0; i < 3; i++) fake.hooks.emit('pattern:shotHit', shotHit(stats, e as never));
    expect(e.status.shredStacks).toBe(SHRED.cap); // two ★3 hits left 1 + 1, the 3rd nail's combo adds 2 (capped at 3)
  });
});
