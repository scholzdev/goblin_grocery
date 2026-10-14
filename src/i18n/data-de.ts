import type { DepartmentId, EnemyId, ItemTypeId, RecipeId, StarterId } from '../types';
import type { CartSkin, GoblinSkin } from '../data/unlocks';

// German texts for all data tables. Record over the id unions: a missing entry is a type error.
type IR = { name: string; blurb: string; rules: string };
type NB = { name: string; blurb: string };

const items: Record<ItemTypeId, IR> = {
  toaster: { name: 'Toaster', blurb: 'Schleudert heißen Toast auf die nächste Ware.', rules: 'Feuert alle {1} Toast für {0} Schaden. 440 Reichweite. Jeder Toast trifft einen Gegner.' },
  pan: { name: 'Bratpfanne', blurb: 'Großer, scheppernder Schwung um den Wagen.', rules: 'Schwingt alle {1} auf Gegner in der Nähe für {0} Schaden. 150 Reichweite. Trifft jeden Gegner einmal pro Schwung.' },
  nailgun: { name: 'Nagelpistole', blurb: 'Ratatatat, Dreier-Nagelsalven.', rules: 'Feuert alle {1} eine Dreier-Nagelsalve. {0} Schaden pro Nagel. 480 Reichweite.' },
  vacuum: { name: 'Staubsauger', blurb: 'Saugt Waren heran. Münzen übrigens auch.', rules: 'Pulsiert alle {1} für {0} Schaden und zieht Gegner in der Nähe leicht nach innen. +60 Münz-Sammelradius.' },
  fan: { name: 'Tischventilator', blurb: 'Wuusch. Mehr Reichweite für alles, was er berührt.', rules: 'Jede angrenzende Waffe erhält {0} Reichweite und {1} Projektiltempo.' },
  fuel: { name: 'Benzinkanister', blurb: 'Fragwürdig. Setzt jeden Treffer in Brand.', rules: 'Jede angrenzende Waffe setzt Gegner in Brand: {0} Brandschaden für 2 s (erneuert sich, stapelt sich nie).' },
  battery: { name: 'Batterie', blurb: 'Zack! Schnellere Angriffe, bei Elektrogeräten besonders.', rules: 'Jede angrenzende Waffe erhält {0} Angriffstempo; elektrische Waffen {1}.' },
  magnet: { name: 'Magnet', blurb: 'Münzen kommen zu dir.', rules: '{0} Münz-Sammelradius (stapelt sich nicht). Schaltet Nagelsturm neben einer Nagelpistole frei.' },
  ice: { name: 'Kühlakku', blurb: 'Eisige Treffer bremsen Waren aus.', rules: 'Treffer der angrenzenden Waffe verlangsamen Gegner um {0} für 1 s. Wiederholte Treffer erneuern den Effekt.' },
  hotsauce: { name: 'Scharfe Soße', blurb: 'Extra scharfer Schaden.', rules: 'Angrenzende Waffen erhalten {0} Trefferschaden.' },
  lunchbox: { name: 'Brotdose', blurb: 'Ein Pausenbrot. +15 max. LP.', rules: '{0} maximale LP, solange ausgerüstet (stapelt sich nicht, heilt nicht). Schaltet Fertiggericht frei.' },
  bell: { name: 'Einkaufsklingel', blurb: 'Kling! Öfter rempeln.', rules: 'Rempler-Abklingzeit {0} (stapelt sich nicht). Schaltet Schnellkasse neben einer Bratpfanne frei.' },
  boot: { name: 'Rennstiefel', blurb: 'Sprinter aus dem Wühltisch. Dash, als hättest du ihn geklaut.', rules: 'Leertasten-Dash: {0} Distanz und {1} Schaden.' },
  microwave: { name: 'Mikrowelle', blurb: 'Kling! Beamt eine Ware quer durch den Gang.', rules: 'Zappt alle {1} einen Gegner im Umkreis von 380 für {0} Schaden, mit Flächenschaden im Umkreis von 70. Elektrisch.' },
  blender: { name: 'Mixer', blurb: 'Surrende Klingen rund um den Wagen.', rules: 'Schreddert alle {1} jeden Gegner im Umkreis von 85 für {0} Schaden (jeden Gegner einmal pro Tick). Elektrisch.' },
  fizz: { name: 'Sprudelkanone', blurb: 'Geschüttelte Limo schießt abprallende Kronkorken.', rules: 'Feuert alle {1} einen Kronkorken für {0} Schaden, der auf 2 weitere Gegner abprallt (nie zweimal auf denselben). 420 Reichweite.' },
  mop: { name: 'Wischmopp', blurb: 'Hinterlässt rutschige Seifenpfützen.', rules: 'Hinterlässt alle {1} eine Seifenpfütze (Radius 60, hält 3 s). Gegner darin rutschen: 25% langsamer und {0} Schaden alle 0,5 s.' },
  pricegun: { name: 'Preisauszeichner', blurb: 'Zeichnet Waren mit 50% RABATT aus. Volltreffer!', rules: 'Angrenzende Waffen erhalten {0} Chance auf einen kritischen Treffer mit doppeltem Schaden (nicht Brand). Schaltet Räumungsverkauf frei.' },
  tape: { name: 'Panzertape', blurb: 'Hält alles zusammen. Macht es auch größer.', rules: 'Jede angrenzende Waffe: Projektile durchschlagen {0}, Schwünge und Kegel {1} Bogen, Flächen {2} Radius, Strahlen {2} Länge.' },
  coupon: { name: 'Couponheft', blurb: 'Extra Ersparnis bei jedem Abschuss.', rules: 'Abschüsse lassen mit {0} Chance +1 Münze fallen (stapelt sich nicht). Schaltet Räumungsverkauf frei.' },
  bubblewrap: { name: 'Luftpolsterfolie', blurb: 'Platzsichere Polsterung für deinen Wagen.', rules: 'Nimm {0} Schaden weniger pro Treffer (mindestens 1) und +0,25 s Unverwundbarkeit nach einem Treffer (stapelt sich nicht).' },
  energy: { name: 'Energydrink', blurb: 'Wruum wruum. Schnellerer Wagen.', rules: '{0} Bewegungstempo (stapelt sich nicht).' },
  powerstrip: { name: 'Steckdosenleiste', blurb: 'Steckt den ganzen Wagen auf einmal ein.', rules: 'Jede elektrische Waffe im Wagen erhält +20% Angriffstempo; elektrische Waffen, die sie berühren, stattdessen +40%.' },
  goldstar: { name: 'Goldstern-Sticker', blurb: 'Lehrers Liebling. Alles in der Nähe gibt sich mehr Mühe.', rules: 'Module und Passive, die ihn berühren, wirken eine Stufe höher (bis zu ★4 Stärke). Waffen, die ihn berühren, erhalten +1 Sparpaket-Gegenstand.' },
  laser: { name: 'Selbstscan-Laser', blurb: 'Unerwarteter Artikel im Gepäckbereich. ZACK.', rules: 'Feuert alle 1,6 s einen Barcode-Strahl (620 lang), der jeden Gegner auf der Linie einmal für 20 Schaden trifft. Elektrisch.' },
  snackbag: { name: 'Familienpackung Snacks', blurb: 'Bodenlos. Vermutlich.', rules: '+20 max. LP und 1 LP Regeneration alle 4 s im Kampf (stapelt sich nicht).' },
  cooker: { name: 'Schnellkochtopf', blurb: 'Schleudert einen pfeifenden Topf. KABUMM.', rules: 'Schleudert alle {1} einen Topf auf die dichteste Gruppe im Umkreis von 420. Er explodiert und macht {0} Schaden an allem im Umkreis von 90, mit Rückstoß.' },
  spray: { name: 'Sprühflasche', blurb: 'Pssht pssht pssht. Trifft alles davor.', rules: 'Sprüht alle {1} einen 70°-Kegel (170 Reichweite) und macht {0} Schaden an jedem Gegner darin (je einmal pro Sprühstoß).' },
  popper: { name: 'Partyknaller', blurb: 'Jeder Abschuss ist ein Fest.', rules: 'Von angrenzenden Waffen besiegte Gegner explodieren in Konfetti: {0} Schaden im Umkreis von 70. Knaller-Explosionen lösen keine Kettenreaktion aus.' },
  doublebag: { name: 'Doppeltüte', blurb: 'Doppelte Tüte, doppelter Wumms.', rules: 'Direkte Treffer angrenzender Waffen schlagen 0,12 s später ein zweites Mal zu, für {0} Schaden.' },
  multipack: { name: 'Multipack', blurb: 'Eins kaufen, zwei feuern.', rules: 'Jede angrenzende Waffe: Projektile {0}, Schwünge/Kegel/Mörser greifen einmal zusätzlich an, andere Waffen {1} Schaden.' },
};

const recipes: Record<RecipeId, { name: string; short: string; summary: string; detail: string }> = {
  toastMode: { name: 'Toast-Modus', short: '3 flammende Toasts pro Schuss', summary: 'Toaster berührt Tischventilator UND Benzinkanister: flammender Dreifach-Toast-Fächer.', detail: 'Feuert 3 Toasts im Fächer. Jeder macht 75% Schaden und setzt Gegner in Brand (Brand stapelt sich nicht). Ventilator-Tempo und -Reichweite gelten weiterhin.' },
  nailstorm: { name: 'Nagelsturm', short: 'Nägel durchschlagen und kurven', summary: 'Nagelpistole berührt Magnet UND Batterie: durchschlagende, kurvende Nägel.', detail: 'Jeder Nagel durchschlägt einen weiteren Gegner und kurvt nach dem ersten Treffer auf ein nahes Ziel zu. Das Batterie-Angriffstempo gilt weiterhin.' },
  coldStorage: { name: 'Kühlhaus', short: 'Riesiger Frostpuls', summary: 'Staubsauger berührt Kühlakku: Frostring-Puls.', detail: 'Pulse reichen 20% weiter, machen 2,5× Schaden und hinterlassen einen Frostring, der Gegner 1,5 s um 50% verlangsamt. Ersetzt die Kühlakku-Verlangsamung (nie addiert).' },
  expressCheckout: { name: 'Schnellkasse', short: 'Rempler → Bonus-Pfannenschwung', summary: 'Bratpfanne berührt Einkaufsklingel: Rempler löst einen Bonusschwung aus.', detail: 'Ein Rempler, der einen Gegner trifft, löst einen zusätzlichen Pfannenschwung aus (1,0 s interne Abklingzeit). Die Rempler-Abklingzeit-Senkung der Klingel gilt weiterhin.' },
  brainFreeze: { name: 'Eiskopfschmerz', short: 'Breitere, frostige Klingen', summary: 'Mixer berührt Kühlakku: ein eisiger, breiterer Klingensturm.', detail: 'Klingenradius +25% und jeder Tick verlangsamt um 40% für 0,6 s. Ersetzt die Kühlakku-Verlangsamung für diese Waffe (nie addiert).' },
  tvDinner: { name: 'Fertiggericht', short: 'Zaps springen auf +1 Gegner', summary: 'Mikrowelle berührt Brotdose UND Batterie: kettenzappende Mahlzeiten.', detail: 'Jeder Zap springt auf 1 weiteren Gegner in der Nähe über (60% Schaden) und die Mikrowelle feuert 8% schneller (zusätzlich zur Batterie).' },
  clearanceSale: { name: 'Räumungsverkauf', short: '+2 Abpraller, Krittreffer lassen Münzen fallen', summary: 'Sprudelkanone berührt Preisauszeichner UND Couponheft: Alles muss raus!', detail: 'Kronkorken prallen 2 weitere Male ab, und kritische Treffer schütteln eine Bonusmünze los (einmal pro Gegner).' },
  greaseFire: { name: 'Fettbrand', short: 'Riesige brennende Lachen', summary: 'Wischmopp berührt Benzinkanister: riesige brennende Fettlachen.', detail: 'Pfützen werden zu Fettbränden: 40% größer, und ihr Brand ist verdoppelt (6 Schaden/s, kein Stapeln).' },
  pressurePoint: { name: 'Druckpunkt', short: 'Explosionen hinterlassen Feuerlachen', summary: 'Schnellkochtopf berührt Benzinkanister: Explosionen hinterlassen brennende Lachen.', detail: 'Jede Explosion hinterlässt 2,5 s lang eine Feuerlache: Gegner darin brennen (3 Schaden/s, kein Stapeln).' },
  mistMachine: { name: 'Nebelmaschine', short: 'Riesiger 120°-Sprühkegel', summary: 'Sprühflasche berührt Tischventilator: ein riesiger Nebelkegel.', detail: 'Der Sprühkegel wird 120° breit und reicht 40% weiter. (Der Ventilator-Bonus auf Tempo/Reichweite gilt nicht für Sprühstöße, dies ersetzt ihn.)' },
  fiveAlarm: { name: 'Fünf-Alarm-Toast', short: '+80% gegen Brennende', summary: 'Toaster berührt Scharfe Soße UND Benzinkanister: Toast versengt brennende Waren.', detail: 'Toast macht +80% Schaden an Gegnern, die bereits brennen.' },
  sizzlingSkillet: { name: 'Zischende Pfanne', short: 'Schwünge hinterlassen Feuer', summary: 'Bratpfanne berührt Benzinkanister: jeder Schwung versengt den Boden.', detail: 'Jeder Schwung hinterlässt 2 s lang einen brennenden Bogen auf dem Boden. Gegner, die hindurchlaufen, fangen Feuer.' },
  frostbiteNails: { name: 'Frostbeulen-Nägel', short: '3. Treffer friert ein', summary: 'Nagelpistole berührt Kühlakku: Nägel frieren Waren steif.', detail: 'Nägel durchschlagen 1 weiteren Gegner, und jeder 3. Nagel, der denselben Gegner trifft, friert ihn 0,7 s lang fest.' },
  staticCling: { name: 'Statische Aufladung', short: 'Pulse zappen 3', summary: 'Staubsauger berührt Batterie: Pulse schleudern Blitze.', detail: 'Jeder Puls zappt zusätzlich bis zu 3 Gegner in seinem Radius für 150% Pulsschaden.' },
  reheat: { name: 'Aufwärmen', short: 'Zaps hinterlassen Feuer', summary: 'Mikrowelle berührt Benzinkanister: angebrannt!', detail: 'Jeder Zap hinterlässt 2,5 s lang eine brennende Lache am Ziel.' },
  smoothieShield: { name: 'Smoothie-Schild', short: 'Klingen fressen Geschosse', summary: 'Mixer berührt Luftpolsterfolie: die Klingen schreddern gegnerische Projektile.', detail: 'Blasen und Kassenbons, die in den Klingenring geraten, werden zerstört.' },
  confettiCannon: { name: 'Konfettikanone', short: 'Abpraller explodieren', summary: 'Sprudelkanone berührt Partyknaller: jeder Abpraller ist eine Party.', detail: 'Jeder Kronkorken-Abpraller löst eine kleine Konfettiexplosion aus: 50% Schaden im Umkreis von 60 (Explosionen lösen keine Kettenreaktion aus).' },
  blackIce: { name: 'Glatteis', short: 'Pfützen gefrieren', summary: 'Wischmopp berührt Kühlakku: Pfützen frieren zu.', detail: 'Wenn ein Gegner zum ersten Mal in eine Pfütze tritt, friert er 0,8 s lang fest.' },
  shrapnel: { name: 'Splitterbombe', short: 'Explosionen versprühen Nägel', summary: 'Schnellkochtopf berührt Panzertape: der Deckel fliegt ab. Mit Schwung.', detail: 'Jede Explosion schleudert 6 Topfsplitter nach außen (40% Schaden, Durchschlag 1).' },
  pressureWasher: { name: 'Hochdruckreiniger', short: 'Langer, harter Strahl', summary: 'Sprühflasche berührt Batterie: motorisierter Strahl.', detail: 'Der Sprühstoß wird zum schmalen Strahl: 25° breit, doppelte Reichweite, 2,5× Schaden.' },
  powerSurge: { name: 'Stromstoß', short: 'Strahl-Nachbeben', summary: 'Selbstscan-Laser berührt Steckdosenleiste: doppelter Scan.', detail: 'Jeder Strahl löst 0,25 s später ein Nachbeben für 25% Schaden aus.' },
  priceCheck: { name: 'Preisprüfung', short: 'Markiert: +20% Schaden', summary: 'Selbstscan-Laser berührt Preisauszeichner: alles bekommt einen Aufkleber.', detail: 'Vom Strahl getroffene Gegner sind 3 s lang markiert und erleiden +20% Schaden von allem.' },
};

const enemies: Record<EnemyId, NB> = {
  milk: { name: 'Saure Milch', blurb: 'Über dem Datum und stinksauer darüber. Läuft einfach auf dich zu. Immer wieder.' },
  banana: { name: 'Bananen-Bandit', blurb: 'Holt aus und rutscht dann zum Schlitterangriff heran. Weich aus.' },
  soda: { name: 'Limo-Sixpack', blurb: 'Sechs Dosen, ein Groll. Langsam und sprudelzäh; zuckt kaum bei Remplern.' },
  spitter: { name: 'Spülmittel-Spucker', blurb: 'Spritzt aus der Ferne langsame Spülmittelblasen. Geh ran oder weich aus.' },
  baguette: { name: 'Baguette-Rabauke', blurb: 'Schwingt einen breiten, knusprigen Bogen, wenn du zu nah kommst. Geh weg oder brich ihn.' },
  egg: { name: 'Eierkarton', blurb: 'Watschelt heran und explodiert. Platz ihn zuerst.' },
  melon: { name: 'Wassermelone', blurb: 'Platzt beim Tod in drei flinke Scheiben. Vorsicht, Matsch.' },
  turkey: { name: 'Gefrorener Truthahn', blurb: 'Steinhart gefroren, schwer wie ein Ziegel. Braucht ewig zum Auftauen.' },
  beans: { name: 'Dosenbohnen', blurb: 'Verbeult, dicht und gepanzert: direkte Treffer verlieren 3 Schaden. Brand, Pfützen und Auren ignorieren die Dose.' },
  cereal: { name: 'Müslipackung', blurb: 'Hält eine Pappfront hoch: Die ersten 6 Schüsse prallen ab, dann weicht sie durch. Schwünge, Explosionen, Brand und Rempler ignorieren sie.' },
  honey: { name: 'Honigglas', blurb: 'Hält sich hinten und heilt Waren in der Nähe jede Sekunde um 3%. Klebrig; zuerst platzieren.' },
  giftcard: { name: 'Geschenkkarte', blurb: 'Rennt vor dir weg und entwischt nach 8 Sekunden. Schnapp sie dir für einen Münz-Jackpot.' },
  expired: { name: 'Abgelaufene Milch', blurb: 'Flackert und blinkt dann direkt neben dich. Achte auf den gestrichelten Ring.' },
  gum: { name: 'Kaugummi', blurb: 'Kaut hinter dir her und hinterlässt klebrige rosa Pfützen, die dich verlangsamen. Platzt zur Falle.' },
  slice: { name: 'Melonenscheibe', blurb: 'Ein saftiger kleiner Rest. Flink, zerbrechlich, keine Münzen wert.' },
  boss: { name: 'Der Filialleiter', blurb: 'Salven, Ansturm und Verstärkung. Wird ungemütlich, wenn du zu lange brauchst.' },
};

const departments: Record<DepartmentId, { name: string; short: string; blurb: string; enemiesText: string; rewardText: string }> = {
  main: { name: 'Hauptgang', short: 'HAUPTGANG', blurb: 'Keine Gefahren', enemiesText: 'Müsli, Bohnen, Limo & Honig', rewardText: 'Kein Bonus' },
  frozen: { name: 'Tiefkühlkost', short: 'TIEFKÜHL', blurb: 'Eisflächen: weitere Rempler, Gegner rutschen', enemiesText: 'Truthähne, Abgelaufene Milch, Saure Milch & Limo', rewardText: 'Kühl-Angebote im Shop' },
  bakery: { name: 'Bäckerei', short: 'BÄCKEREI', blurb: 'Ofenschächte blasen Hitze (trifft auch Waren!)', enemiesText: 'Baguettes, Eier, Honig & Bananen', rewardText: 'Brotkrumen heilen · Küchen-Angebote im Shop' },
  electronics: { name: 'Elektronik', short: 'ELEKTRONIK', blurb: 'Stromkabel zappen und betäuben Waren', enemiesText: 'Spucker, Bohnen, Müsli & Abgelaufene Milch', rewardText: 'Elektrische Waffen hier +15% Tempo · Gadget-Angebote' },
  checkout: { name: 'Kassenzone', short: 'KASSE', blurb: 'Förderbänder tragen alles mit', enemiesText: 'Kaugummi, Melonen, Bananen & Geschenkkarten', rewardText: 'Kein Bonus' },
  clearance: { name: 'Wühltisch', short: 'WÜHLTISCH', blurb: 'Keine Gefahren, nur VIELE Waren', enemiesText: '+35% Waren, +25% LP, Müsli & Honig', rewardText: '+50% Münzen · garantiert legendär im nächsten Shop' },
  boss: { name: 'Kasse des Filialleiters', short: 'FILIALLEITER', blurb: 'Der Filialleiter erwartet dich', enemiesText: 'Boss + Verstärkung', rewardText: 'Sieg' },
};

const shifts: NB[] = [
  { name: 'Tagschicht', blurb: 'Der Laden, wie du ihn kennst.' },
  { name: 'Spätschicht', blurb: 'Zähere Waren.' },
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
  spray: 'Gib 150 Waren zurück (insgesamt)',
  fizz: 'Entdecke 2 Combos',
  mop: 'Räume 3 Bäckerei-Gänge',
  blender: 'Räume 3 Tiefkühlkost-Gänge',
  tape: 'Beende 2 Runs',
  pricegun: 'Verdiene 400 Münzen (insgesamt)',
  coupon: 'Räume 3 Kassenzonen-Gänge',
  bubblewrap: 'Lass dich einmal plattmachen',
  energy: 'Gib 500 Waren zurück (insgesamt)',
  cooker: 'Räume 3 Elektronik-Gänge',
  popper: 'Erreiche Gang 6',
  doublebag: 'Entdecke 4 Combos',
  multipack: 'Erreiche den Filialleiter',
  powerstrip: 'Besiege den Filialleiter',
  snackbag: 'Besiege den Filialleiter',
  goldstar: 'Entdecke 7 Combos',
  boot: 'Beende 3 Runs',
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

export const DATA_DE = { items, recipes, enemies, departments, shifts, starters, goblinSkins, cartSkins, unlocks, tags };
