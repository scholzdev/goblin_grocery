import { t } from '../i18n';
import { itemT } from '../i18n/data';
import { cellsFor, cellsOf } from '../data/items';
import type { Cell, Inventory, ItemInstance, ItemTypeId, OpResult, Rotation } from '../types';

const norm = (cells: Cell[]): Cell[] => {
  const mx = Math.min(...cells.map((c) => c.x)), my = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - mx, y: c.y - my }));
};

/** Rotate 90° clockwise `rot` times (y down), normalized to min 0,0. */
export function rotateCells(cells: Cell[], rot: Rotation): Cell[] {
  let out = cells;
  for (let i = 0; i < rot; i++) out = out.map((c) => ({ x: -c.y, y: c.x }));
  return norm(out);
}

export const footprint = (inst: ItemInstance): Cell[] =>
  rotateCells(cellsOf(inst), inst.rot).map((c) => ({ x: c.x + inst.x, y: c.y + inst.y }));

export function rotatedSize(type: ItemTypeId, rot: Rotation, tier = 1): { w: number; h: number } {
  const cs = rotateCells(cellsFor(type, tier), rot);
  return { w: Math.max(...cs.map((c) => c.x)) + 1, h: Math.max(...cs.map((c) => c.y)) + 1 };
}

export function canPlace(inv: Inventory, type: ItemTypeId, x: number, y: number, rot: Rotation, ignoreUid?: string, tier = 1): OpResult {
  const cells = rotateCells(cellsFor(type, tier), rot).map((c) => ({ x: c.x + x, y: c.y + y }));
  if (cells.some((c) => c.x < 0 || c.y < 0 || c.x >= inv.cols || c.y >= inv.rows)) return { ok: false, reason: t('rNoFit') };
  for (const o of inv.placed) {
    if (o.uid === ignoreUid) continue;
    const fp = footprint(o);
    if (cells.some((c) => fp.some((f) => f.x === c.x && f.y === c.y))) return { ok: false, reason: t('rOverlaps', { name: itemT(o.type).name }) };
  }
  return { ok: true };
}

export function adjacentPairs(placed: ItemInstance[]): [string, string][] {
  const at = new Map<string, string>();
  for (const p of placed) for (const c of footprint(p)) at.set(`${c.x},${c.y}`, p.uid);
  const seen = new Set<string>();
  for (const [k, a] of at) {
    const [x, y] = k.split(',').map(Number);
    for (const b of [at.get(`${x + 1},${y}`), at.get(`${x},${y + 1}`)]) if (b && b !== a) seen.add(a < b ? `${a}\0${b}` : `${b}\0${a}`);
  }
  return [...seen].sort().map((s) => s.split('\0') as [string, string]);
}

export function neighbors(placed: ItemInstance[], uid: string): ItemInstance[] {
  const ids = new Set(adjacentPairs(placed).filter((p) => p.includes(uid)).flat());
  ids.delete(uid);
  return placed.filter((p) => ids.has(p.uid));
}

export type Found = { where: 'grid'; inst: ItemInstance } | { where: 'shelf'; slot: number; inst: ItemInstance };

export function findItem(inv: Inventory, uid: string): Found | null {
  const g = inv.placed.find((p) => p.uid === uid);
  if (g) return { where: 'grid', inst: g };
  const slot = inv.shelf.findIndex((s) => s?.uid === uid);
  return slot >= 0 ? { where: 'shelf', slot, inst: inv.shelf[slot]! } : null;
}

const key = (cs: Cell[]) => cs.map((c) => `${c.x},${c.y}`).sort().join(';');

/** Smallest rotation with an identical footprint. */
export function normalizeRotation(type: ItemTypeId, rot: Rotation, tier = 1): Rotation {
  const cs = cellsFor(type, tier), k = key(rotateCells(cs, rot));
  for (let r = 0 as Rotation; r < rot; r++) if (key(rotateCells(cs, r)) === k) return r;
  return rot;
}
