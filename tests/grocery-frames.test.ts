import { describe, expect, it } from 'vitest';
import { SVG_ASSETS } from '../src/data/assets';
import { ENEMIES, MINI_BOSS, enemyFrame, isBossId } from '../src/data/enemies';
import { ENEMY_ORDER } from '../src/engine/define';
import type { EnemyBehavior, EnemyId } from '../src/types';

const drawn = new Set(SVG_ASSETS.map((a) => a.key));
const groceries = ENEMY_ORDER.filter((id) => !isBossId(id));
const missing = (ids: Iterable<EnemyId>, f: 'tell' | 'hurt'): EnemyId[] => [...ids].filter((id) => !drawn.has(enemyFrame(id, f)));

// The behaviors whose AI calls startTell (scenes/enemies.ts): they wind up before they strike.
const TELEGRAPHING: readonly EnemyBehavior[] = ['charger', 'swiper', 'spitter', 'exploder', 'teleporter'];

describe('grocery frames', () => {
  it('every grocery has a hurt face to show when it takes a hit', () => {
    expect(groceries.length).toBeGreaterThan(0);
    expect(missing(groceries, 'hurt')).toEqual([]);
  });

  it('every grocery that telegraphs an attack has a tell frame', () => {
    const tellers = groceries.filter((id) => TELEGRAPHING.includes(ENEMIES[id].behavior));
    expect(tellers.length).toBeGreaterThan(0);
    expect(missing(tellers, 'tell')).toEqual([]);
  });

  it('every grocery that can grow into the mid-shift boss has a tell frame', () => {
    const giants = new Set(MINI_BOSS.variants.flatMap((v) => Object.values(v.byTheme)).filter((id): id is EnemyId => !!id));
    expect(giants.size).toBeGreaterThan(0);
    expect(missing(giants, 'tell')).toEqual([]);
  });
});
