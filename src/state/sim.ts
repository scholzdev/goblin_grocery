import { ECONOMY } from '../data/waves';
import { SIM_DEFAULTS, SimError, layoutCart, validateSim, type SimDef } from '../sims/_sim';
import { mulberry32, type Rng } from '../systems/rng';
import type { ItemInstance, LabOpts, RunState } from '../types';
import { chooseDoor, createLabRun, leaveShop, newUid, openShop, recomputeBuild, startNextWave } from './run';

/**
 * Builds the run a sim describes, without Phaser: the cart holds exactly the sim's items (no starter weapon), the build is computed.
 * `start: 'shop'` returns the shop phase; `'arena'` returns the fight (sandbox: combat with the dummies spawned by the flow;
 * `waves: true`: the real aisle, reached through the shop and door like a Test Lab run). `rng` is the run rng (the flow passes its own);
 * the default is the seeded one, so two calls with the same sim give the same state. Throws SimError for an invalid sim.
 */
export function createSimRun(sim: SimDef, rng: Rng = mulberry32(sim.seed ?? SIM_DEFAULTS.seed)): RunState {
  const problems = validateSim(sim);
  if (problems.length) throw new SimError(sim.id, problems);
  const D = SIM_DEFAULTS;
  const waves = sim.waves ?? D.waves, start = sim.start ?? D.start, seed = sim.seed ?? D.seed, doorMod = sim.doorMod ?? D.doorMod;
  const cartSize = sim.cartSize ?? D.cartSize;
  const opts: LabOpts = {
    aisle: sim.aisle ?? D.aisle, dept: sim.department ?? D.department, shift: sim.shift ?? D.shift, starter: sim.character ?? D.character, weapon: 'toaster', money: sim.money ?? D.money,
    cart: [cartSize[0], cartSize[1]], shelf: Math.max(ECONOMY.shelfSlots, sim.shelf?.length ?? 0), shopLevel: sim.shopLevel ?? D.shopLevel,
    god: sim.god ?? D.god, event: sim.event ?? D.event, mod: doorMod, sandbox: !waves,
  };
  const s = createLabRun(seed, opts);
  const { slots } = layoutCart(sim);
  sim.cart.forEach((e, i) => {
    const p = slots[i]!;
    const inst: ItemInstance = { uid: newUid(s), type: p.type, x: p.x, y: p.y, rot: p.rot, tier: p.tier };
    if (e.id === 'jellybeans') inst.flavor = p.flavor ?? 'heat';
    if (e.age !== undefined) inst.age = e.age;
    if (e.kills !== undefined) inst.kills = e.kills;
    s.inventory.placed.push(inst);
  });
  sim.shelf?.forEach((e, i) => {
    const inst: ItemInstance = { uid: newUid(s), type: e.id, x: 0, y: 0, rot: 0, tier: e.tier ?? 1 };
    if (e.id === 'jellybeans') inst.flavor = 'heat';
    s.inventory.shelf[i] = inst;
  });
  if (!waves) s.modifier = doorMod; // the sandbox never walks through a door
  recomputeBuild(s);
  s.hp = s.build.maxHp;

  const flavors = new Map(s.inventory.placed.filter((i) => i.type === 'jellybeans').map((i) => [i.uid, i.flavor]));
  if (waves || start === 'shop') {
    openShop(s, rng); // rolls the offers; it also re-rolls Jelly Beans flavors, so the sim's are put back
    for (const i of s.inventory.placed) if (i.type === 'jellybeans') i.flavor = flavors.get(i.uid);
    recomputeBuild(s);
    s.hp = s.build.maxHp;
  }
  if (start === 'arena') {
    if (waves) { leaveShop(s, rng); chooseDoor(s, s.doors![0]); startNextWave(s); } // shop -> door -> aisle, as a lab run does
    else { s.phase = 'combat'; s.shop = null; s.coinLog = []; }
  }
  if (sim.hp !== undefined) s.hp = Math.min(sim.hp, s.build.maxHp); // last, so nothing above (recomputeBuild, openShop, the wave start) resets it
  return s;
}
