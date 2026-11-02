import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYS, actionFor, bindingLabel, clearSlot, defaultKeys, isReserved, keyLabel, matches, rebind, sanitizeKeys } from '../src/state/keymap';

describe('keymap', () => {
  it('defaults: WASD primary with arrows secondary, one key for the rest', () => {
    const k = defaultKeys();
    expect(k.up).toEqual(['KeyW', 'ArrowUp']);
    expect(k.shove[0]).toBe('Space');
    expect(matches(k, 'pause', 'Escape')).toBe(true);
    expect(actionFor(k, 'KeyR')).toBe('rotate');
    expect(actionFor(k, 'KeyP')).toBeNull();
  });

  it('every default key is used once', () => {
    const all = Object.values(DEFAULT_KEYS).flat().filter(Boolean);
    expect(new Set(all).size).toBe(all.length);
  });

  it('rebinding to a free key replaces the slot', () => {
    const r = rebind(defaultKeys(), 'shove', 0, 'KeyE');
    expect(r.ok).toBe(true);
    expect(r.keys.shove[0]).toBe('KeyE');
    expect(matches(r.keys, 'shove', 'Space')).toBe(false);
  });

  it('rebinding to a key in use swaps the two slots', () => {
    const r = rebind(defaultKeys(), 'shove', 0, 'KeyR'); // R belongs to rotate
    expect(r.ok).toBe(true);
    expect(r.displaced).toBe('rotate');
    expect(r.keys.shove[0]).toBe('KeyR');
    expect(r.keys.rotate[0]).toBe('Space');
  });

  it('into an empty slot, the key is taken from its old owner', () => {
    const r = rebind(defaultKeys(), 'shove', 1, 'ArrowUp');
    expect(r.ok).toBe(true);
    expect(r.keys.shove).toEqual(['Space', 'ArrowUp']);
    expect(r.keys.up).toEqual(['KeyW', '']);
  });

  it('refuses to strip an action of its last key', () => {
    const r = rebind(defaultKeys(), 'shove', 1, 'Tab'); // Tab is the loadout key and its only one
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('last');
    expect(r.keys).toEqual(defaultKeys());
  });

  it('refuses reserved keys', () => {
    for (const c of ['Digit1', 'Numpad3', 'F2', 'Enter', 'Backspace']) {
      expect(isReserved(c)).toBe(true);
      expect(rebind(defaultKeys(), 'rotate', 0, c).ok).toBe(false);
    }
    expect(isReserved('KeyZ')).toBe(false);
  });

  it('does not mutate its input', () => {
    const k = defaultKeys();
    rebind(k, 'up', 0, 'KeyR');
    expect(k).toEqual(DEFAULT_KEYS);
  });

  it('clearSlot empties a spare slot but keeps the last key', () => {
    expect(clearSlot(defaultKeys(), 'up', 1).keys.up).toEqual(['KeyW', '']);
    expect(clearSlot(defaultKeys(), 'rotate', 0).ok).toBe(false);
  });

  it('reset-to-defaults is a fresh copy of the defaults', () => {
    const changed = rebind(defaultKeys(), 'up', 0, 'KeyI').keys;
    const reset = defaultKeys();
    expect(reset).toEqual(DEFAULT_KEYS);
    expect(reset).not.toBe(DEFAULT_KEYS);
    expect(changed.up[0]).toBe('KeyI');
  });

  it('sanitizeKeys repairs stored junk', () => {
    expect(sanitizeKeys(undefined)).toEqual(DEFAULT_KEYS);
    expect(sanitizeKeys({ up: 'x', shove: [5, 'Digit1'] })).toEqual(DEFAULT_KEYS);
    const dup = sanitizeKeys({ up: ['KeyQ', ''], down: ['KeyQ', 'KeyZ'] });
    expect(dup.up).toEqual(['KeyQ', '']);
    expect(dup.down).toEqual(['', 'KeyZ']); // a code is only kept for its first owner
  });

  it('labels', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Space', 'LEERTASTE')).toBe('LEERTASTE');
    expect(keyLabel('Digit5')).toBe('5');
    expect(keyLabel('')).toBe('—');
    expect(bindingLabel(defaultKeys(), 'up')).toBe('W / ↑');
    expect(bindingLabel(defaultKeys(), 'pause')).toBe('ESC');
  });

  it('ignores removed useActive* actions in a stored keymap', () => {
    const stored = { ...defaultKeys(), useActive1: ['KeyQ', ''], useActive2: ['KeyE', ''], useActive3: ['KeyF', ''], useActive: ['KeyG', ''], up: ['KeyI', ''] };
    const k = sanitizeKeys(stored);
    expect(Object.keys(k).sort()).toEqual(Object.keys(defaultKeys()).sort());
    expect(k.up[0]).toBe('KeyI');
    expect(Object.keys(k).some((a) => a.startsWith('useActive'))).toBe(false);
  });
});
