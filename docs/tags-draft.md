# Tags-Draft: Familien + Elemente

Status: Entwurf, nichts implementiert. Grundlage: alle 31 Items aus `src/data/items.ts`.

## Regeln

- Jedes Item hat **genau 1 Familie** und **0–1 Element**.
- **Elektro** bleibt das bestehende Flag `electrical` (Batterie, Power Strip und die Elektronik-Abteilung lesen es schon). Neu: `battery` und `powerstrip` bekommen `electrical: true`. Das ändert keine Mechanik, weil diese Checks nur auf Waffen schauen. Damit können `toaster` und `microwave` Hitze **und** Elektro sein.
- Set-Bonus zählt **verschiedene Item-Typen im ganzen Cart**, ohne Adjacency. Die Ablage zählt nicht. Adjacency bleibt Rezepten, Modulen und dem Bundle Deal vorbehalten, damit Sets nicht mit Rezepten kollidieren.
- Stufen **2 / 3**, nicht 2 / 4: Der Cart startet jetzt mit 4×4 = 16 Zellen, ein 4er-Set wäre früh kaum machbar. Tradeoff: Ab Cart 6×5 sind 3er-Sets leicht. Falls das zu stark wird, später eine 4er-Stufe ergänzen.
- Sets bleiben **unter** Rezept-Niveau. Rezepte geben ×1.8–2.5, eine 2er-Stufe soll ≈ +8–12 % geben, eine 3er-Stufe ≈ +20 % oder einen Effekt. Vergleichswerte: Hot Sauce +25 %, Fan ×1.3, Batterie ×1.12, Bundle +6 % pro Typ.
- Nur bestehende Status-Effekte: Brennen, Verlangsamen, Betäuben, Markierung, Krit. Kein neues Status-System.

## Alle Items

| id | Art | Familie | Element | Hinweis |
|---|---|---|---|---|
| `toaster` | Waffe | Küche | Hitze (+Elektro) | fiveAlarm, toastMode |
| `pan` | Waffe | Küche | Hitze | sizzlingSkillet, expressCheckout |
| `microwave` | Waffe | Küche | Hitze (+Elektro) | reheat, tvDinner |
| `blender` | Waffe | Küche | (Elektro) | brainFreeze, smoothieShield |
| `cooker` | Waffe | Küche | Hitze | pressurePoint, shrapnel |
| `hotsauce` | Modul | Küche | Hitze | +25 % Schaden |
| `ice` | Modul | Küche | Frost | Slow 25 %, 4 Rezepte |
| `vacuum` | Waffe | Putzen | (Elektro) | coldStorage, staticCling, +60 Münz-Sammelradius |
| `mop` | Waffe | Putzen | Frost | Pfütze ist schon ein Slow. greaseFire, blackIce |
| `spray` | Waffe | Putzen | Frost | mistMachine, pressureWasher |
| `fan` | Modul | Putzen | – | Reichweite ×1.3 |
| `nailgun` | Waffe | Werkzeug | Knall (+Elektro) | nailstorm, frostbiteNails |
| `tape` | Modul | Werkzeug | – | +Durchschlag / Bogen / Fläche |
| `fuel` | Modul | Werkzeug | Hitze | Brennen 2.5 dps, 5 Rezepte |
| `battery` | Modul | Werkzeug | Elektro (neu) | Tempo ×1.12 / ×1.18 |
| `powerstrip` | Modul ★L | Werkzeug | Elektro (neu) | Elektro-Tempo ÷1.2 / ÷1.4 |
| `magnet` | Passiv | Werkzeug | – | +60 Münz-Sammelradius |
| `boot` | Passiv | Werkzeug | – | Dash ×1.35, +6 Dash-Schaden |
| `fizz` | Waffe | Snacks | Frost | „eiskalte Limo“. clearanceSale, confettiCannon |
| `popper` | Modul | Snacks | Knall | Kill-Explosion 6 |
| `multipack` | Modul | Snacks | Knall | +1 Projektil / Wiederholung |
| `lunchbox` | Passiv | Snacks | – | +15 max HP |
| `energy` | Passiv | Snacks | – | +12 % Laufgeschwindigkeit |
| `snackbag` | Passiv ★L | Snacks | – | +20 HP, Regeneration 0.25/s |
| `laser` | Waffe ★L | Kasse | (Elektro) | powerSurge, priceCheck |
| `pricegun` | Modul | Kasse | – | 15 % Krit ×2 |
| `doublebag` | Modul | Kasse | Knall | Echo 50 % |
| `coupon` | Passiv | Kasse | – | +1 Münze pro Kill (30 %) |
| `bell` | Passiv | Kasse | – | Schubser-Abklingzeit −0.5 s |
| `bubblewrap` | Passiv | Kasse | – | −1 Schaden, +0.25 s Unverwundbarkeit |
| `goldstar` | Modul ★L | Kasse | – | +1 Stufe für Nachbarn |

**Verteilung**

| Familie | Anzahl | davon Waffen |
|---|---|---|
| Küche | 7 | 5 |
| Putzen | 4 | 3 |
| Werkzeug | 7 | 1 |
| Snacks | 6 | 1 |
| Kasse | 7 | 1 |

| Element | Anzahl | Mitglieder |
|---|---|---|
| Hitze | 6 | toaster, pan, microwave, cooker, hotsauce, fuel |
| Elektro | 8 | toaster, nailgun, vacuum, microwave, blender, laser, battery, powerstrip |
| Frost | 4 | ice, mop, spray, fizz |
| Knall | 4 | nailgun, popper, multipack, doublebag |

**Gestrichen: Klebrig.** Nur `tape` würde passen, Kaugummi ist ein Gegner. Das ist zu dünn für ein Set. Alternative: 1–2 neue Items, z. B. eine Leimfalle (Modul, Treffer kleben 0.4 s) und eine Honig-Spritze (Waffe). Dann Klebrig als 5. Element.

Kälte und Nass sind zu **Frost** zusammengelegt. Kälte allein wäre nur `ice` gewesen.

## Familien-Sets

| Familie | 2 Typen | 3 Typen |
|---|---|---|
| **Küche** | Küchenwaffen +10 % Schaden | Kills durch Küchenwaffen: 5 % Chance auf einen Imbiss-Drop, der 3 HP heilt |
| **Putzen** | Putzwaffen +15 % Reichweite/Fläche | Putzwaffen-Treffer +40 % Rückstoß, Pfützen halten +1 s |
| **Werkzeug** | Alle Waffen +8 % Angriffstempo | Dash/Schubser: Schaden ×2, betäubt 0.3 s |
| **Snacks** | +10 max HP | Regeneration 0.3 HP/s im Kampf (stapelt mit `snackbag`) |
| **Kasse** | Shop-Preise −8 % | Zinsen: +1 Münze pro 10 Münzen am Aisle-Ende (max. +5) |

Begründung: Küche und Putzen sind waffenlastig, deshalb sind ihre Boni Kampfwerte. Werkzeug, Snacks und Kasse bestehen fast nur aus Modulen und Passiven, deshalb geben sie Mobilität, Überleben und Wirtschaft. So zwingt kein Set zu einem bestimmten Waffen-Stack.

## Element-Sets

| Element | 2 Typen | 3 Typen |
|---|---|---|
| **Hitze** | Brennen hält +1 s (2 → 3 s) | Brennen 2.5 → 3.5 dps. Hitze-Waffen setzen auch ohne `fuel` mit 15 % Chance in Brand |
| **Frost** | Alle Slows +10 Prozentpunkte (Obergrenze bleibt 60 %) | Treffer auf Gegner mit ≥ 40 % Slow: 10 % Chance auf 0.5 s Einfrieren (Boss immun) |
| **Elektro** | Treffer von Elektrowaffen: 10 % Chance, auf 1 Gegner im Umkreis 120 überzuspringen (50 % Schaden) | 20 % Chance, 2 Sprünge |
| **Knall** | Explosionsradius ×1.15 (popper, cooker, microwave-Splash, confettiCannon) | Kills: 10 % Chance auf eine Mini-Explosion (6 Schaden, r 60, keine Kette) |

Elektro gibt bewusst **kein** Tempo, weil Batterie und Power Strip das schon tun. Stattdessen Kettenblitz, ein neuer Effekt mit den bestehenden Mitteln: direkter Schaden auf ein Nachbarziel, wie bei tvDinner und staticCling.

Obergrenzen gegenüber Rezepten: Hitze 3 (×1.4 dps) bleibt unter fiveAlarm (×1.8). Frost 3 (10 % / 0.5 s) bleibt unter blackIce und frostbiteNails (garantiert / 0.7–0.8 s). Knall 3 bleibt unter `popper` (100 %).

## Kombinationen

### Familie × Element (Item-Anzahl)

| | Hitze | Frost | Elektro | Knall |
|---|---|---|---|---|
| Küche | **5** | 1 | 3 | 0 |
| Putzen | 0 | **2** | 1 | 0 |
| Werkzeug | 1 | 0 | **3** | 1 |
| Snacks | 0 | 1 | 0 | **2** |
| Kasse | 0 | 0 | 1 | 1 |

### Archetypen, die damit entstehen

1. **Großküche** (Küche 3 + Hitze 3): `toaster` + `pan` + `cooker` + `fuel`/`hotsauce`. Rezepte: fiveAlarm, sizzlingSkillet, pressurePoint, reheat. **Größtes Balance-Risiko**: 5 der 22 Rezepte sind Brand-Pools, plus beide Sets. Zuerst testen.
2. **Frostputz** (Putzen 3 + Frost 3): `mop` + `spray` + `ice` + `fan`. Rezepte: blackIce, mistMachine. Kontroll-Build: Gegner kommen kaum an.
3. **Werkstatt** (Werkzeug 3 + Elektro 3): `nailgun` + `battery` + `powerstrip` + `magnet`. Rezept: nailstorm. Tempo plus Kettenblitz, mit starkem Dash.
4. **Party** (Snacks 3 + Knall 3): `fizz` + `popper` + `multipack` + `lunchbox`. Rezept: confettiCannon. Explosionsketten mit Überleben.
5. **Kassensturz** (Kasse 3): `laser` + `pricegun` + `coupon` + `goldstar`. Rezept: priceCheck. Wirtschafts-Build: weniger Schaden, mehr Geld.
6. **Kühlschrank** (Elektro + Frost, Mischung): `vacuum`/`blender` + `ice`. Rezepte: coldStorage, brainFreeze.

### Lücken, wo Sets der Klebstoff sind

- Küche × Frost: nur `ice`. Damit kommt `blender` + `ice` auf Frost 2, wenn noch `mop` oder `fizz` dazukommt.
- Putzen × Hitze: leer. greaseFire (`mop` + `fuel`) ist die einzige Brücke. Fine, Putzen soll Kontrolle sein.
- Kasse × Element: fast leer, gewollt. Kasse ist die Wirtschafts-Familie.
- Werkzeug hat nur 1 Waffe (`nailgun`). Wer Werkzeug 3 will, baut über Module und Passive. Das ist ok, weil der Werkzeug-Bonus nicht waffengebunden ist.

## Datenform (Vorschlag)

```ts
type FamilyTag = 'kitchen' | 'cleaning' | 'tools' | 'snacks' | 'checkout';
type ElementTag = 'heat' | 'frost' | 'blast';   // Elektro bleibt `electrical: boolean`
interface ItemDef { family: FamilyTag; element?: ElementTag; tags?: WeaponTag[]; electrical: boolean; /* … */ }
```

`tags` (ranged/melee/area) bleibt als Waffenrolle unverändert. Set-Zählung kommt nach `computeBuild` in `src/systems/synergies.ts`, über die verschiedenen `type` in `inventory.placed`.

Stellen, die angefasst werden müssen:

- `src/types.ts`, `src/data/items.ts` (alle 31 Einträge)
- `src/systems/synergies.ts`: Set-Zählung und Boni
- Shop-UI: Familien- und Element-Chips. `tagChips` in `src/ui/shop.ts:88` wird nicht aufgerufen, das ist toter Code. Außerdem ist der Inspector betroffen.
- `src/ui/ui.ts:267`: `it.tags![0]` absichern
- `src/i18n/data-de.ts:153`: deutsche Texte für neue Tags. `tests/i18n.test.ts:30` erweitern, sonst fehlen deutsche Texte unbemerkt.
- `src/ui/style.css:512`: Chip-Farben
- Optional `src/systems/shop.ts`: Shop-Gewichtung +1.4 für Items, die ein angefangenes Set fortsetzen (wie `ENHANCES`)
- Set-Anzeige im Shop, z. B. „Küche 2/3“

## Nebenbei gefunden: Texte stimmen nicht mit dem Code

- greaseFire: Text sagt 6 dps, Code ergibt Fuel × 2 = 5 dps. `RECIPE_TUNING.*.dps` (greaseFire, pressurePoint, reheat, sizzlingSkillet) wird nirgends gelesen.
- mistMachine: Text sagt, der Fan wirkt nicht. Code wendet Fan ×1.3 trotzdem an.
- priceCheck: Kommentar in `ArenaScene.ts:450` sagt +30 %, Wert ist ×1.2.
