import type { DepartmentId, EnemyId, ItemTypeId, RecipeId, StarterId } from '../types';
import type { CartSkin, GoblinSkin } from '../data/unlocks';
import { itemTextOf, recipeTextOf } from '../engine/legacy';
import { contentCombos, contentItems } from '../engine/registry';
import type { ZoneId } from '../data/zones';

// German texts for all data tables. Record over the id unions: a missing entry is a type error.
type IR = { name: string; blurb: string; rules: string };
type NB = { name: string; blurb: string };

/** Items still translated here; content items bring their own German text (merged into DATA_DE below). */
const items: Partial<Record<ItemTypeId, IR>> = {};

const enemies: Record<EnemyId, NB> = {
  milk: { name: 'Saure Milch', blurb: 'Über dem Datum und stinksauer darüber. Läuft einfach auf dich zu. Immer wieder.' },
  banana: { name: 'Bananen-Bandit', blurb: 'Holt aus und rutscht dann zum Schlitterangriff heran. Weich aus.' },
  soda: { name: 'Limo-Sixpack', blurb: 'Sechs Dosen, ein Groll. Langsam und sprudelzäh; zuckt kaum bei Dashes.' },
  spitter: { name: 'Spülmittel-Spucker', blurb: 'Spritzt aus der Ferne langsame Spülmittelblasen. Geh ran oder weich aus.' },
  baguette: { name: 'Baguette-Rabauke', blurb: 'Schwingt einen breiten, knusprigen Bogen, wenn du zu nah kommst. Geh weg oder brich ihn.' },
  egg: { name: 'Eierkarton', blurb: 'Watschelt heran und explodiert. Platz ihn zuerst.' },
  melon: { name: 'Wassermelone', blurb: 'Platzt beim Tod in drei flinke Scheiben. Vorsicht, Matsch.' },
  turkey: { name: 'Gefrorener Truthahn', blurb: 'Steinhart gefroren, schwer wie ein Ziegel. Braucht ewig zum Auftauen.' },
  beans: { name: 'Dosenbohnen', blurb: 'Verbeult, dicht und gepanzert: direkte Treffer verlieren 3 Schaden. Brand, Pfützen und Auren ignorieren die Dose.' },
  cereal: { name: 'Müslipackung', blurb: 'Hält eine Pappfront hoch: Die ersten 6 Schüsse prallen ab, dann weicht sie durch. Schwünge, Explosionen, Brand und Dashes ignorieren sie.' },
  honey: { name: 'Honigglas', blurb: 'Hält sich hinten und heilt Gegner in der Nähe jede Sekunde um 3%. Klebrig; zuerst platzieren.' },
  giftcard: { name: 'Geschenkkarte', blurb: 'Rennt vor dir weg und entwischt nach 8 Sekunden. Schnapp sie dir für einen Münz-Jackpot.' },
  expired: { name: 'Abgelaufene Milch', blurb: 'Flackert und blinkt dann direkt neben dich. Achte auf den gestrichelten Ring.' },
  gum: { name: 'Kaugummi', blurb: 'Kaut hinter dir her und hinterlässt klebrige rosa Pfützen, die dich verlangsamen. Platzt zur Falle.' },
  slice: { name: 'Melonenscheibe', blurb: 'Ein saftiger kleiner Rest. Flink, zerbrechlich, keine Münzen wert.' },
  boss: { name: 'Der Filialleiter', blurb: 'Salven, Ansturm und Verstärkung. Wird ungemütlich, wenn du zu lange brauchst.' },
  boss_frozen: { name: 'Der Kühlraum', blurb: 'Langsam, riesig und eiskalt. Seine Kälteeinbrüche machen den Boden zu bremsendem Matsch, und sein Ansturm rutscht weiter.' },
  boss_bakery: { name: 'Der Industrieofen', blurb: 'Enge Toast-Fächer, Feuerringe und ein stetiger Nachschub an Baguettes.' },
  boss_electronics: { name: 'Die Smart-TV-Wand', blurb: 'Zappt Bahnen aus Starkstromkabeln über den Boden, feuert breite schnelle Fächer und startet Spucker.' },
  boss_checkout: { name: 'Die Selbstbedienungskasse', blurb: 'Lässt das Fließband gegen dich laufen und rammt dich dann. Holt Kaugummis und Geschenkkarten dazu.' },
};

const departments: Record<DepartmentId, { name: string; short: string; blurb: string; enemiesText: string; rewardText: string }> = {
  main: { name: 'Hauptgang', short: 'HAUPTGANG', blurb: 'Keine Gefahren', enemiesText: 'Müsli, Bohnen, Limo & Honig', rewardText: 'Kein Bonus' },
  frozen: { name: 'Tiefkühlkost', short: 'TIEFKÜHL', blurb: 'Eisflächen: weitere Dashes, Gegner rutschen', enemiesText: 'Truthähne, Abgelaufene Milch, Saure Milch & Limo', rewardText: 'Kühl-Angebote im Shop' },
  bakery: { name: 'Bäckerei', short: 'BÄCKEREI', blurb: 'Ofenschächte blasen Hitze (trifft auch Gegner!)', enemiesText: 'Baguettes, Eier, Honig & Bananen', rewardText: 'Brotkrumen heilen · Küchen-Angebote im Shop' },
  electronics: { name: 'Elektronik', short: 'ELEKTRONIK', blurb: 'Stromkabel zappen und betäuben Gegner', enemiesText: 'Spucker, Bohnen, Müsli & Abgelaufene Milch', rewardText: 'Elektrische Waffen hier +15% Tempo · Gadget-Angebote' },
  checkout: { name: 'Kassenzone', short: 'KASSE', blurb: 'Förderbänder tragen alles mit', enemiesText: 'Kaugummi, Melonen, Bananen & Geschenkkarten', rewardText: 'Kein Bonus' },
  clearance: { name: 'Wühltisch', short: 'WÜHLTISCH', blurb: 'Keine Gefahren, nur VIELE Gegner', enemiesText: '+35% Gegner, +25% LP, Müsli & Honig', rewardText: '+25% Münzen · garantiert legendär im nächsten Shop' },
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

const withContent = <K extends string, V>(legacy: Partial<Record<K, V>>, content: readonly [K, V][]): Record<K, V> => ({ ...legacy, ...Object.fromEntries(content) }) as Record<K, V>;

export const DATA_DE = {
  items: withContent(items, contentItems().map((c) => [c.id, itemTextOf(c, 'de')] as const)),
  recipes: Object.fromEntries(contentCombos().map((c) => [c.id, recipeTextOf(c, 'de')])) as Record<RecipeId, { name: string; short: string; summary: string; detail: string }>, // every combo is content: its German text lives in its file
  enemies, departments, zones, shifts, starters, goblinSkins, cartSkins, unlocks, tags,
};
