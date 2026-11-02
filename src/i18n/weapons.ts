import { contentLang } from './index';
import type { ItemTypeId } from '../types';

/** Identities explain the actual mechanics; the item rules retain exact tuning. */
const ROLES: Partial<Record<ItemTypeId, Record<'en' | 'de', string>>> = {
  toaster: { en: 'Finisher: seeks wounded enemies; +50% damage below half health.', de: 'Vollstrecker: sucht verletzte Gegner; +50 % Schaden unter halben LP.' },
  laser: { en: 'Line piercer: cuts through the best enemy line. Reposition to line them up.', de: 'Linienbrecher: durchschlägt die beste Gegnerlinie. Richte sie durch Bewegung aus.' },
  microwave: { en: 'Elite hunter: repeated zaps on the same target gain +25% damage, up to +75%.', de: 'Elitejäger: wiederholte Zaps auf dasselbe Ziel erhalten +25 % Schaden, bis +75 %.' },
  nailgun: { en: 'Focus fire: keeps a burst on one target. Consecutive hits gain +8% damage, up to +40%; resets on a new target or after 1.5 s.', de: 'Fokusfeuer: hält eine Salve auf einem Ziel. Folgetreffer erhalten +8 % Schaden, bis +40 %; neues Ziel oder 1,5 s Pause setzen zurück.' },
  fizz: { en: 'Ricochet: carries damage between separate enemies. Needs several targets.', de: 'Abpraller: trägt Schaden zwischen Gegnern weiter. Braucht mehrere Ziele.' },
  popcorn: { en: 'Barrage: splits many kernels across the crowd. Unreliable focus damage.', de: 'Sperrfeuer: verteilt viele Körner auf die Menge. Unzuverlässiger Fokusschaden.' },
  cooker: { en: 'Crowd bomb: lobs delayed explosions into dense groups. Keep enemies together.', de: 'Mengenbombe: wirft verzögerte Explosionen in dichte Gruppen. Halte Gegner zusammen.' },
  blender: { en: 'Shredder: sustained damage to everything close to the cart. Requires risky proximity.', de: 'Schredder: Dauerschaden an allem nahe dem Wagen. Erfordert riskante Nähe.' },
  tomato: { en: 'Decay: poisons fresh targets. Kite while poison works; finishers benefit from the weakened crowd.', de: 'Verfall: vergiftet frische Ziele. Halte Abstand, während das Gift wirkt.' },
  spray: { en: 'Soaker: rapidly applies Wet in front. Sets up electric and frost follow-ups.', de: 'Einweicher: macht Gegner davor schnell nass. Bereitet Strom- und Frosttreffer vor.' },
  mop: { en: 'Trail maker: leaves persistent wet damage zones behind the cart. Lead pursuers through them.', de: 'Spurenleger: hinterlässt nasse Schadenszonen. Locke Verfolger hindurch.' },
  snowcone: { en: 'Frost setup: leaves slowing slush; prepares freezing and sliding reactions.', de: 'Frostvorbereitung: hinterlässt bremsenden Matsch; bereitet Einfrieren und Rutschen vor.' },
  leafblower: { en: 'Displacer: pushes enemies into walls and props for slam damage.', de: 'Wegbläser: stößt Gegner für Aufprallschaden gegen Wände und Deko.' },
  pan: { en: 'Bodyguard: knocks nearby enemies away in an arc. Protects the cart between attacks.', de: 'Leibwächter: stößt nahe Gegner in einem Bogen weg. Schützt den Wagen.' },
  vacuum: { en: 'Grouper: pulls enemies into close-range attacks and collects coins. Pair with crowd damage.', de: 'Sammler: zieht Gegner in Nahbereichsangriffe und sammelt Münzen. Kombiniere mit Flächenschaden.' },
};

export const weaponRoleT = (id: ItemTypeId): string => ROLES[id]?.[contentLang()] ?? '';
