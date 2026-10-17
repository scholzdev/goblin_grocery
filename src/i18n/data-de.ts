import type { DepartmentId, StarterId } from '../types';
import type { CartSkin, GoblinSkin } from '../data/unlocks';
import type { ZoneId } from '../data/zones';

// German texts for the data tables. Record over the id unions: a missing entry is a type error. Items, combos, sets and enemies are not here:
// their German text lives in the content file (src/content/<kind>/<id>.ts), read through i18n/data.
type NB = { name: string; blurb: string };

const departments: Record<DepartmentId, { name: string; short: string; blurb: string; enemiesText: string; rewardText: string }> = {
  main: { name: 'Hauptgang', short: 'HAUPTGANG', blurb: 'Keine Gefahren', enemiesText: 'Müsli, Bohnen, Limo & Honig', rewardText: 'Kein Bonus' },
  frozen: { name: 'Tiefkühlkost', short: 'TIEFKÜHL', blurb: 'Eisflächen: weitere Dashes, Gegner rutschen', enemiesText: 'Truthähne, Abgelaufene Milch, Saure Milch & Limo', rewardText: 'Kühl-Angebote im Shop' },
  bakery: { name: 'Bäckerei', short: 'BÄCKEREI', blurb: 'Ofenschächte blasen Hitze (trifft auch Gegner!)', enemiesText: 'Baguettes, Eier, Honig & Bananen', rewardText: 'Brotkrumen heilen · Küchen-Angebote im Shop' },
  electronics: { name: 'Elektronik', short: 'ELEKTRONIK', blurb: 'Stromkabel zappen und betäuben Gegner', enemiesText: 'Spucker, Bohnen, Müsli & Abgelaufene Milch', rewardText: 'Elektrische Waffen hier +15% Tempo · Gadget-Angebote' },
  checkout: { name: 'Kassenzone', short: 'KASSE', blurb: 'Förderbänder tragen alles mit', enemiesText: 'Kaugummi, Melonen, Bananen & Geschenkkarten', rewardText: 'Kein Bonus' },
  boss: { name: 'Kasse des Filialleiters', short: 'FILIALLEITER', blurb: 'Der Filialleiter erwartet dich', enemiesText: 'Boss + Verstärkung', rewardText: 'Sieg' },
};

const shifts: NB[] = [
  { name: 'Tagschicht', blurb: 'Der Laden, wie du ihn kennst.' },
  { name: 'Spätschicht', blurb: 'Zähere Gegner.' },
  { name: 'Zwischenschicht', blurb: 'Zäher, schneller, mehr davon.' },
  { name: 'Nachtschicht', blurb: 'Volle Gänge, dünnere Taschen.' },
  { name: 'Black Friday', blurb: 'Alle wollen eine Rückerstattung. Alle.' },
];

const starters: Record<StarterId, NB> = {
  toaster: { name: 'Toast-Goblin', blurb: 'Der Allrounder. Keine Boni, keine Nachteile.' },
  pan: { name: 'Küchenchef', blurb: 'Abgehärtet vom Küchendienst, im Gang etwas langsam.' },
  coupon: { name: 'Couponsammler', blurb: 'Feilscht um alles, hat aber schnell blaue Flecken.' },
  night: { name: 'Nachtschicht', blurb: 'Flink auf den Beinen, müde Arme.' },
};

const goblinSkins: Record<GoblinSkin, NB> = {
  classic: { name: 'Klassischer Goblin', blurb: 'Frisch grün, frisch aus dem Müllcontainer.' },
  night: { name: 'Nachtschicht', blurb: 'Lilahäutiger Kassenschließer. Hat in Gang 9 Dinge gesehen.' },
  frost: { name: 'Gefrierbrand', blurb: 'Zu viele Schichten in der Tiefkühlkost verbracht.' },
  gold: { name: 'Mitarbeiter des Monats', blurb: 'Glänzend. Unerträglich damit.' },
};

const cartSkins: Record<CartSkin, NB> = {
  chrome: { name: 'Filialwagen', blurb: 'Quietschendes Vorderrad inklusive.' },
  coral: { name: 'Sonderangebots-Wagen', blurb: 'Lackiert in Rabattaufkleber-Koralle.' },
  gold: { name: 'Goldener Wagen', blurb: 'Für Goblins, die den Filialleiter besiegt haben.' },
};

const unlocks: Record<string, string> = {
  microwave: 'Erreiche Gang 4',
  spray: 'Besiege 150 Gegner (insgesamt)',
  fizz: 'Entdecke 2 Combos',
  mop: 'Räume 3 Bäckerei-Gänge',
  blender: 'Räume 3 Tiefkühlkost-Gänge',
  tape: 'Beende 2 Runs',
  pricegun: 'Verdiene 400 Münzen (insgesamt)',
  coupon: 'Räume 3 Kassenzonen-Gänge',
  bubblewrap: 'Lass dich einmal plattmachen',
  expiredmilk: 'Lass dich 3-mal plattmachen',
  tinfoilhat: 'Erreiche Gang 5',
  jellybeans: 'Entdecke 3 Kombos',
  leafblower: 'Besiege 300 Gegner (insgesamt)',
  sourdough: 'Beende einen Durchlauf',
  energy: 'Besiege 500 Gegner (insgesamt)',
  cooker: 'Räume 3 Elektronik-Gänge',
  popper: 'Erreiche Gang 6',
  doublebag: 'Entdecke 4 Combos',
  multipack: 'Erreiche den Filialleiter',
  powerstrip: 'Besiege den Filialleiter',
  snackbag: 'Besiege den Filialleiter',
  goldstar: 'Entdecke 7 Combos',
  boot: 'Beende 3 Runs',
  sparewheel: 'Beende 4 Runs',
  tipjar: 'Verdiene 250 Münzen (insgesamt)',
  bumper: 'Erreiche Gang 5',
  flag: 'Räume 2 Tiefkühlkost-Gänge',
  laser: 'Gewinne 3 Runs',
  'starter-coupon': 'Verdiene 400 Münzen (insgesamt)',
  'starter-night': 'Erreiche Gang 6',
  'skin-night': 'Beende 5 Runs',
  'skin-frost': 'Räume 12 Tiefkühlkost-Gänge',
  'skin-gold': 'Entdecke 15 Combos',
  'cart-coral': 'Räume einen Wühltisch-Gang',
  'cart-gold': 'Besiege den Filialleiter',
};

// Weapon tags only: the set names (kitchen ... electric) live in src/content/sets/<id>.ts.
const tags: Record<string, string> = { ranged: 'Fernkampf', melee: 'Nahkampf', area: 'Fläche' };

const zones: Record<ZoneId, { name: string; blurb: string }> = {
  cereal_wall: { name: 'Müsliwand', blurb: 'Lange Regalgassen' },
  can_pyramids: { name: 'Dosenpyramiden', blurb: 'Stapel als Deckung überall' },
  promo_island: { name: 'Aktions-Insel', blurb: 'Großer Block, rundherum frei' },
  freezer_row: { name: 'Truhenreihe', blurb: 'Gefriertruhen, mehr Eis' },
  icecream_island: { name: 'Eiscreme-Insel', blurb: 'Eine Truhen-Insel in der Mitte' },
  walk_in: { name: 'Kühlraum', blurb: 'Eng und vollgestellt, weniger Eis' },
  oven_line: { name: 'Ofenstraße', blurb: 'Kaum Deckung, heiße Schächte' },
  bread_racks: { name: 'Brotregale', blurb: 'Regalreihen bilden Gassen' },
  cake_counter: { name: 'Tortentheke', blurb: 'Theken am Rand, Mitte frei' },
  tv_wall: { name: 'TV-Wand', blurb: 'Spärlich, lange Sichtlinien' },
  cable_aisle: { name: 'Kabelgang', blurb: 'Spulen und mehr Stromkabel' },
  demo_booths: { name: 'Demo-Stände', blurb: 'Inselstände zum Verstecken' },
  conveyor_lanes: { name: 'Kassenbänder', blurb: 'Trenner entlang der Bänder' },
  self_checkout: { name: 'SB-Kassen', blurb: 'Kioske überall verstreut' },
  cart_corral: { name: 'Wagenpark', blurb: 'Viele kleine Blocker' },
};

export const DATA_DE = {
  departments, zones, shifts, starters, goblinSkins, cartSkins, unlocks, tags,
};
