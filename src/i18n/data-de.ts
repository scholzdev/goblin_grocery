import type { DepartmentId, EnemyId, ItemTypeId, RecipeId, StarterId } from '../types';
import type { CartSkin, GoblinSkin } from '../data/unlocks';
import { itemTextOf, recipeTextOf } from '../engine/legacy';
import { contentCombos, contentItems } from '../engine/registry';
import type { ZoneId } from '../data/zones';

// German texts for all data tables. Record over the id unions: a missing entry is a type error.
type IR = { name: string; blurb: string; rules: string };
type NB = { name: string; blurb: string };

/** Items still translated here; content items bring their own German text (merged into DATA_DE below). */
const items: Partial<Record<ItemTypeId, IR>> = {
  toaster: { name: 'Toaster', blurb: 'Schleudert heißen Toast auf den nächsten Gegner.', rules: 'Feuert alle {1} Toast für {0} Schaden. 455 Reichweite. Jeder Toast trifft einen Gegner.' },
  pan: { name: 'Bratpfanne', blurb: 'Großer, scheppernder Schwung um den Wagen.', rules: 'Schwingt alle {1} auf Gegner in der Nähe für {0} Schaden. 150 Reichweite. Trifft jeden Gegner einmal pro Schwung.' },
  nailgun: { name: 'Nagelpistole', blurb: 'Ratatatat, Dreier-Nagelsalven.', rules: 'Feuert alle {1} eine Dreier-Nagelsalve. {0} Schaden pro Nagel. 480 Reichweite.' },
  vacuum: { name: 'Staubsauger', blurb: 'Saugt Gegner heran. Münzen übrigens auch.', rules: 'Zieht Gegner in der Nähe ständig zum Wagen. Alle {1} erleiden Gegner im Radius {0} Schaden. +60 Münz-Sammelradius.' },
  bumper: { name: 'Rammschutz', blurb: 'Lande den Dash mit einem Knall.', rules: 'Der Leertasten-Dash endet in einer Druckwelle: {0} Schaden im Umkreis von 90 und Rückstoß (stapelt sich nicht). Schaltet Topf-Slam neben einem Schnellkochtopf frei.' },
  sparewheel: { name: 'Ersatzrad', blurb: 'Zwei Dashes zum Preis von einem.', rules: 'Nach einem Dash ist ein weiterer Dash innerhalb von {0} gratis: er überspringt die Abklingzeit (stapelt sich nicht).' },
  tipjar: { name: 'Trinkgeldglas', blurb: 'Anrempeln. Sie geben Trinkgeld.', rules: 'Jeder Gegner, den der Leertasten-Dash trifft, lässt mit {0} Chance eine Münze fallen (stapelt sich nicht).' },
  flag: { name: 'Sale-Fähnchen', blurb: 'Steck es ihnen in den Rücken. Alles 20% reduziert.', rules: 'Vom Leertasten-Dash getroffene Gegner sind {0} markiert: Sie erleiden +20% Schaden von allem (stapelt sich nicht).' },
  boot: { name: 'Rennstiefel', blurb: 'Sprinter aus dem Wühltisch. Dash, als hättest du ihn geklaut.', rules: 'Leertasten-Dash: {0} Distanz und {1} Schaden.' },
  microwave: { name: 'Mikrowelle', blurb: 'Kling! Beamt einen Gegner quer durch den Gang.', rules: 'Zappt alle {1} den zähsten Gegner im Umkreis von 380 (zuerst Elite, dann meiste LP) für {0} Schaden, mit Flächenschaden im Umkreis von 70. Elektrisch.' },
  blender: { name: 'Mixer', blurb: 'Surrende Klingen rund um den Wagen.', rules: 'Schreddert alle {1} jeden Gegner im Umkreis von 85 für {0} Schaden (jeden Gegner einmal pro Tick). Elektrisch.' },
  fizz: { name: 'Sprudelkanone', blurb: 'Geschüttelte Limo schießt abprallende Kronkorken.', rules: 'Feuert alle {1} einen Kronkorken für {0} Schaden, der auf 2 weitere Gegner abprallt (nie zweimal auf denselben). 420 Reichweite.' },
  mop: { name: 'Wischmopp', blurb: 'Hinterlässt rutschige Seifenpfützen.', rules: 'Hinterlässt alle {1} eine Seifenpfütze (Radius 60, hält 3 s). Gegner darin rutschen: 25% langsamer und {0} Schaden alle 0,5 s.' },
  coupon: { name: 'Couponheft', blurb: 'Extra Ersparnis bei jedem Abschuss.', rules: 'Abschüsse lassen mit {0} Chance +1 Münze fallen (stapelt sich nicht). Combo: Räumungsverkauf mit Sprudelkanone + Preisauszeichner.' },
  bubblewrap: { name: 'Luftpolsterfolie', blurb: 'Platzsichere Polsterung für deinen Wagen.', rules: 'Nimm {0} Schaden weniger pro Treffer (mindestens 1) und +0,25 s Unverwundbarkeit nach einem Treffer (stapelt sich nicht).' },
  sample: { name: 'Kostprobe', blurb: 'Nur zum Probieren. Jeder Krit ist ein Häppchen.', rules: 'Jeder Krit heilt {0} LP, höchstens 2 LP pro Sekunde (stapelt sich nicht). Braucht eine Kritquelle wie Preisauszeichner oder Glückskeks.' },
  laser: { name: 'Selbstscan-Laser', blurb: 'Unerwarteter Artikel im Gepäckbereich. ZACK.', rules: 'Feuert alle 1,6 s einen Barcode-Strahl (620 lang), der jeden Gegner auf der Linie einmal für 20 Schaden trifft. Elektrisch.' },
  cooker: { name: 'Schnellkochtopf', blurb: 'Schleudert einen pfeifenden Topf. KABUMM.', rules: 'Schleudert alle {1} einen Topf auf die dichteste Gruppe im Umkreis von 420. Er explodiert und macht {0} Schaden an allem im Umkreis von 90, mit Rückstoß.' },
  spray: { name: 'Sprühflasche', blurb: 'Pssht pssht pssht. Trifft alles davor.', rules: 'Sprüht alle {1} einen 70°-Kegel (170 Reichweite) und macht {0} Schaden an jedem Gegner darin (je einmal pro Sprühstoß).' },
  expiredmilk: { name: 'Abgelaufene Milch', blurb: 'Verflucht. Riecht nach einer schlechten Entscheidung.', rules: 'Verflucht: vergiftet Gegner im Umkreis von 110 um den Wagen: {0} Giftschaden (erneuert sich alle 0,5 s, stapelt sich nicht). Deine max. LP sinken um 10%. Combo: Sauernebel mit Sprühflasche + Tischventilator.' },
  tinfoilhat: { name: 'Aluhut', blurb: 'Blockt das Signal. Und die Limo.', rules: 'Beim Dashen (und 0,1 s danach) werden Gegnerschüsse, die dich berühren, mit {0} ihres Schadens auf die Gegner zurückgeworfen, statt dich zu treffen. Combos: Funkenflug mit Mikrowelle + Batterie; Strahlenkanone mit Nagelpistole + Batterie + Magnet.' },
  leafblower: { name: 'Laubbläser', blurb: 'Puff puff. Schleudert Gegner gegen Sachen.', rules: 'Bläst alle {1} einen 50°-Kegel (220 Reichweite) für {0} Schaden und einen kräftigen Stoß. Weggeblasene Gegner, die gegen eine Wand oder Deko prallen, erleiden 8 Aufprallschaden (skaliert mit der Stufe).' },
};

/** Combos still translated here; content combos bring their own German text (merged into DATA_DE below). */
const recipes: Partial<Record<RecipeId, { name: string; short: string; summary: string; detail: string }>> = {
  toastMode: { name: 'Toast-Modus', short: '3 flammende Toasts pro Schuss', summary: 'Toaster berührt Tischventilator UND Benzinkanister: flammender Dreifach-Toast-Fächer.', detail: 'Feuert 3 Toasts im Fächer. Jeder macht 75% Schaden und setzt Gegner in Brand (Brand stapelt sich nicht). Ventilator-Tempo und -Reichweite gelten weiterhin.' },
  nailstorm: { name: 'Nagelsturm', short: 'Nägel durchschlagen und kurven', summary: 'Nagelpistole berührt Magnet UND Batterie: durchschlagende, kurvende Nägel.', detail: 'Jeder Nagel durchschlägt einen weiteren Gegner und kurvt nach dem ersten Treffer auf ein nahes Ziel zu. Das Batterie-Angriffstempo gilt weiterhin.' },
  coldStorage: { name: 'Kühlhaus', short: 'Riesiger Frostsog', summary: 'Staubsauger berührt Kühlakku: eisiger Sog.', detail: 'Der Sog reicht 20% weiter, seine Schadensticks machen 2,5× Schaden und verlangsamen Gegner 1,5 s um 50%. Ersetzt die Kühlakku-Verlangsamung (nie addiert).' },
  expressCheckout: { name: 'Schnellkasse', short: 'Dash → Bonus-Pfannenschwung', summary: 'Bratpfanne berührt Einkaufsklingel: Dash löst einen Bonusschwung aus.', detail: 'Ein Dash, der einen Gegner trifft, löst einen zusätzlichen Pfannenschwung aus (1,0 s interne Abklingzeit). Die Dash-Abklingzeit-Senkung der Klingel gilt weiterhin.' },
  brainFreeze: { name: 'Eiskopfschmerz', short: 'Breitere, frostige Klingen', summary: 'Mixer berührt Kühlakku: ein eisiger, breiterer Klingensturm.', detail: 'Klingenradius +25% und jeder Tick verlangsamt um 40% für 0,6 s. Ersetzt die Kühlakku-Verlangsamung für diese Waffe (nie addiert).' },
  tvDinner: { name: 'Fertiggericht', short: 'Zaps springen auf +1 Gegner', summary: 'Mikrowelle berührt Brotdose UND Batterie: kettenzappende Mahlzeiten.', detail: 'Jeder Zap springt auf 1 weiteren Gegner in der Nähe über (60% Schaden) und die Mikrowelle feuert 8% schneller (zusätzlich zur Batterie).' },
  clearanceSale: { name: 'Räumungsverkauf', short: '+2 Abpraller, Krittreffer lassen Münzen fallen', summary: 'Sprudelkanone berührt Preisauszeichner UND Couponheft: Alles muss raus!', detail: 'Kronkorken prallen 2 weitere Male ab, und kritische Treffer schütteln eine Bonusmünze los (einmal pro Gegner).' },
  greaseFire: { name: 'Fettbrand', short: 'Riesige brennende Lachen', summary: 'Wischmopp berührt Benzinkanister: riesige brennende Fettlachen.', detail: 'Pfützen werden zu Fettbränden: 40% größer, und ihr Brand ist verdoppelt (Benzinkanister-Brand ×2, kein Stapeln).' },
  pressurePoint: { name: 'Druckpunkt', short: 'Explosionen hinterlassen Feuerlachen', summary: 'Schnellkochtopf berührt Benzinkanister: Explosionen hinterlassen brennende Lachen.', detail: 'Jede Explosion hinterlässt 2,5 s lang eine Feuerlache: Gegner darin brennen (mindestens 3 Schaden/s, kein Stapeln).' },
  mistMachine: { name: 'Nebelmaschine', short: 'Riesiger 120°-Sprühkegel', summary: 'Sprühflasche berührt Tischventilator: ein riesiger Nebelkegel.', detail: 'Der Sprühkegel wird 120° breit und reicht 40% weiter. (Der Ventilator-Bonus auf Tempo/Reichweite gilt nicht für Sprühstöße, dies ersetzt ihn.)' },
  fiveAlarm: { name: 'Fünf-Alarm-Toast', short: '+80% gegen Brennende', summary: 'Toaster berührt Scharfe Soße UND Benzinkanister: Toast versengt brennende Gegner.', detail: 'Toast macht +80% Schaden an Gegnern, die bereits brennen.' },
  chickenDinner: { name: 'Hähnchen-Menü', short: 'Jeder 4. Schwung ist riesig', summary: 'Bratpfanne berührt Brotdose: Winner Winner, jeder 4. Schwung ist eine große Portion.', detail: 'Jeder 4. Schwung reicht 40% weiter und verursacht 2,5-fachen Schaden.' },
  sizzlingSkillet: { name: 'Zischende Pfanne', short: 'Schwünge hinterlassen Feuer', summary: 'Bratpfanne berührt Benzinkanister: jeder Schwung versengt den Boden.', detail: 'Jeder Schwung hinterlässt 2 s lang einen brennenden Bogen auf dem Boden. Gegner, die hindurchlaufen, fangen Feuer (mindestens 4 Schaden/s, kein Stapeln).' },
  frostbiteNails: { name: 'Frostbeulen-Nägel', short: '3. Treffer friert ein', summary: 'Nagelpistole berührt Kühlakku: Nägel frieren Gegner steif.', detail: 'Nägel durchschlagen 1 weiteren Gegner, und jeder 3. Nagel, der denselben Gegner trifft, friert ihn 0,7 s lang fest.' },
  staticCling: { name: 'Statische Aufladung', short: 'Ticks zappen 3', summary: 'Staubsauger berührt Batterie: der Sog schleudert Blitze.', detail: 'Jeder Schadenstick zappt zusätzlich bis zu 3 Gegner im Sogradius für 150% Tickschaden.' },
  reheat: { name: 'Aufwärmen', short: 'Zaps hinterlassen Feuer', summary: 'Mikrowelle berührt Benzinkanister: angebrannt!', detail: 'Jeder Zap hinterlässt 2,5 s lang eine brennende Lache am Ziel: Gegner darin brennen (mindestens 3 Schaden/s, kein Stapeln).' },
  smoothieShield: { name: 'Smoothie-Schild', short: 'Klingen fressen Geschosse', summary: 'Mixer berührt Luftpolsterfolie: die Klingen schreddern gegnerische Projektile.', detail: 'Blasen und Kassenbons, die in den Klingenring geraten, werden zerstört.' },
  confettiCannon: { name: 'Konfettikanone', short: 'Abpraller explodieren', summary: 'Sprudelkanone berührt Partyknaller: jeder Abpraller ist eine Party.', detail: 'Jeder Kronkorken-Abpraller löst eine kleine Konfettiexplosion aus: 50% Schaden im Umkreis von 60 (Explosionen lösen keine Kettenreaktion aus).' },
  blackIce: { name: 'Glatteis', short: 'Pfützen gefrieren', summary: 'Wischmopp berührt Kühlakku: Pfützen frieren zu.', detail: 'Wenn ein Gegner zum ersten Mal in eine Pfütze tritt, friert er 0,8 s lang fest.' },
  shrapnel: { name: 'Splitterbombe', short: 'Explosionen versprühen Nägel', summary: 'Schnellkochtopf berührt Panzertape: der Deckel fliegt ab. Mit Schwung.', detail: 'Jede Explosion schleudert 6 Topfsplitter nach außen (40% Schaden, Durchschlag 1).' },
  pressureWasher: { name: 'Hochdruckreiniger', short: 'Langer, harter Strahl', summary: 'Sprühflasche berührt Batterie: motorisierter Strahl.', detail: 'Der Sprühstoß wird zum schmalen Strahl: 25° breit, doppelte Reichweite, 2,5× Schaden.' },
  powerSurge: { name: 'Stromstoß', short: 'Strahl-Nachbeben', summary: 'Selbstscan-Laser berührt Steckdosenleiste: doppelter Scan.', detail: 'Jeder Strahl löst 0,25 s später ein Nachbeben für 25% Schaden aus.' },
  potSlam: { name: 'Topf-Slam', short: 'Dash-Landung = Topfknall', summary: 'Schnellkochtopf berührt Rammschutz: der Dash landet mit einem Topfknall.', detail: 'Jeder Dash endet mit einer vollen Schnellkochtopf-Explosion am Landepunkt (Schaden, Radius und Rückstoß des Topfs). Löst bei jedem Dash aus, unabhängig vom Topf-Timer.' },
  priceCheck: { name: 'Preisprüfung', short: 'Markiert: +20% Schaden', summary: 'Selbstscan-Laser berührt Preisauszeichner: alles bekommt einen Aufkleber.', detail: 'Vom Strahl getroffene Gegner sind 3 s lang markiert und erleiden +20% Schaden von allem.' },
  sugarRush: { name: 'Zuckerschock', short: 'Jeder Dash: +8% Tempo (x5)', summary: 'Energydrink berührt Rennstiefel: jeder Dash löst einen Zuckerrausch aus.', detail: 'Jeder Dash fügt einen Stapel hinzu: +8% Bewegungstempo für 3 s, bis zu 5 Stapel (jeder Stapel läuft einzeln ab).' },
  smashBank: { name: 'Sparschwein-Schlag', short: 'Pfannentreffer lassen Münzen fallen', summary: 'Bratpfanne berührt Sparschwein: draufhauen, und Münzen purzeln heraus.', detail: 'Jeder von einem Pfannenschwung getroffene Gegner lässt mit 15% Chance eine Münze fallen.' },
  bagIt: { name: 'Eingetütet', short: 'Abschüsse laden eine Müllbombe', summary: 'Staubsauger berührt Doppeltüte UND Rennstiefel: Müll einsacken, dann werfen.', detail: 'Jeder vom Staubsauger besiegte Gegner gibt 1 Ladung (max. 10). Ein Dash mit Ladungen wirft einen Müllsack, der nach 0,4 s explodiert: 6 Schaden pro Ladung im Umkreis von 120, mit Rückstoß. Die Ladungen werden zurückgesetzt.' },
  sparksFly: { name: 'Funkenflug', short: 'Zaps springen +2, können betäuben', summary: 'Mikrowelle berührt Aluhut UND Batterie: die Funken fliegen überallhin.', detail: 'Jeder Zap springt auf 2 weitere Gegner in der Nähe über (50% Schaden), und jeder Kettentreffer betäubt mit 25% Chance für 0,3 s. Stapelt sich mit TV-Dinner.' },
  rayGun: { name: 'Strahlenkanone', short: 'Energiestrahlen, Splash, jeder 3. riesig', summary: 'Nagelpistole berührt Batterie, Aluhut UND Magnet: Piu piu.', detail: 'Nägel werden zu grünen Energiestrahlen (ohne Durchschlag), die 60% Schaden auf Gegner im Umkreis von 60 verteilen. Jeder 3. Schuss ist ein roter Überladungsstrahl: Splash-Radius 120 und +20% Splash-Schaden. Ersetzt Nagelsturm.' },
  tailwind: { name: 'Rückenwind', short: 'Böen schieben den Wagen vor', summary: 'Laubbläser berührt Tischventilator UND Rennstiefel: reite auf deinem eigenen Wind.', detail: 'Jede Bläser-Böe gibt dem Wagen einen kurzen Schub nach vorn: +30% Bewegungstempo für 0,4 s, solange du dich bewegst. Ist auch Zuckerschock aktiv, gibt jede Böe einen Zuckerschock-Stapel (1,5 s interne Abklingzeit).' },
  sourMist: { name: 'Sauernebel', short: 'Sprühstoß vergiftet (4/s)', summary: 'Sprühflasche berührt Abgelaufene Milch UND Tischventilator: eine geronnene Wolke.', detail: 'Sprühtreffer vergiften Gegner für 4 Schaden/s über 3 s (erneuert sich, stapelt sich nie).' },
};

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

const tags: Record<string, string> = { ranged: 'Fernkampf', melee: 'Nahkampf', area: 'Fläche', electric: 'Elektrisch', kitchen: 'Küche', cleaning: 'Putzen', tools: 'Werkzeug', snacks: 'Snacks', checkout: 'Kasse', heat: 'Hitze', frost: 'Frost', blast: 'Knall' };

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
  recipes: withContent(recipes, contentCombos().map((c) => [c.id, recipeTextOf(c, 'de')] as const)),
  enemies, departments, zones, shifts, starters, goblinSkins, cartSkins, unlocks, tags,
};
