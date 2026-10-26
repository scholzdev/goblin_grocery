import { describe, expect, it } from 'vitest';
import { SVG_ASSETS } from '../src/data/assets';
import { HURT_FACE_S, enemyTexture, type EnemyLook } from '../src/systems/enemyFrame';

const calm: EnemyLook = { id: 'boss', telling: false, hurtAt: -99, now: 10, step: 0 };
const justHit = (o: Partial<EnemyLook> = {}): EnemyLook => ({ ...calm, hurtAt: 10, ...o });

describe('enemy frame', () => {
  it('draws the Store Manager hurt frame', () => {
    expect(SVG_ASSETS.some((a) => a.key === 'boss_hurt')).toBe(true);
  });

  it('the Store Manager walks while nothing happens, alternating steps', () => {
    expect(enemyTexture(calm)).toBe('boss_a');
    expect(enemyTexture({ ...calm, step: 1 })).toBe('boss_b');
  });

  it('shows the hurt face after a hit, and walks again once it has run out', () => {
    expect(enemyTexture(justHit())).toBe('boss_hurt');
    expect(enemyTexture(justHit({ now: 10 + HURT_FACE_S - 0.01 }))).toBe('boss_hurt');
    expect(enemyTexture(justHit({ now: 10 + HURT_FACE_S, step: 1 }))).toBe('boss_b');
  });

  it('the Store Manager keeps its telegraph readable right after a hit', () => {
    expect(enemyTexture(justHit({ telling: true }))).toBe('boss_tell');
    expect(enemyTexture(justHit({ telling: true, now: 10.1 }))).toBe('boss_tell');
  });

  it('a grocery shows its hurt face after a hit, and walks again once it has run out', () => {
    expect(enemyTexture(justHit({ id: 'milk' }))).toBe('enemy_milk_hurt');
    expect(enemyTexture(justHit({ id: 'milk', now: 10 + HURT_FACE_S }))).toBe('enemy_milk_a');
    expect(enemyTexture(justHit({ id: 'milk', now: 10 + HURT_FACE_S, step: 1 }))).toBe('enemy_milk_b');
  });

  it('a grocery keeps its telegraph readable right after a hit', () => {
    expect(enemyTexture({ ...calm, id: 'banana', telling: true })).toBe('enemy_banana_tell');
    expect(enemyTexture(justHit({ id: 'banana', telling: true }))).toBe('enemy_banana_tell');
    expect(enemyTexture(justHit({ id: 'banana' }))).toBe('enemy_banana_hurt');
  });

  it('a grocery without a tell frame walks while telling', () => {
    expect(enemyTexture({ ...calm, id: 'milk', telling: true })).toBe('enemy_milk_a');
  });
});
