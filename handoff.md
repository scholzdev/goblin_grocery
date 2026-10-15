# Handoff

Stand: 2026-10-15, Commit `acebd32` (+ `b567c89` Run-End-Unlocks).

## Status

Alles unten ist **gebaut, aber nicht getestet**: `npx tsc --noEmit` ist sauber, `npm test` wurde nicht laufen gelassen und nichts wurde im Browser angespielt.

- Alte Tests können an der neuen Set-Stufe 3 scheitern (`thresholds` jetzt `[2, 3, 4]`, Level 0–3).
- Set-Kampf-FX aus früherer Session sind ebenfalls noch visuell unverifiziert.

## Fertig, verifiziert

### Run-End-Unlocks (`b567c89`)
- Endscreen zeigt "Newly unlocked" (Karten mit NEW-Sticker) und "Almost there" (Fortschrittsbalken).
- Zweispaltige Endkarte, wenn es Unlock-Inhalt gibt; passt in 1280×800.
- Katalog: NEW-Tags und Zähler-Punkt am Tab (`profile.seen`, `markSeen`).
- Code: `src/ui/ui.ts` (`freshHtml`, `endHtml`), `src/state/profile.ts` (`snapProfile`, `freshSince`, `nearUnlocks`), `src/flow.ts` (`lastResult`).

## Neu, ungetestet (`acebd32`)

### A. Sets
**Set-Stufe 3** (bei 4 verschiedenen Items)
- `src/data/sets.ts`: `SET_L3`, `setCfg(id, lv)`; Electric nutzt verlängerte Arrays.
- Alle `=== 2`-Checks wurden zu `>= 2` (`synergies.ts`, `ArenaScene.ts`, `weapons.ts`, `run.ts`).

| Set | L3 |
|---|---|
| kitchen | Schaden ×1,2, 10 % Heilung für 4 HP |
| cleaning | Reichweite/Fläche ×1,25, Knockback ×1,8, Pfützen +2 s |
| tools | cooldownDiv 1,15, Dash-Schaden ×3, Stun 0,45 s |
| snacks | +20 max HP, 0,6 HP/s Regen |
| checkout | Preise ×0,85, Zins-Cap 8 |
| heat | Brand +2 s, Brandschaden ×1,8, Entzünden 25 % |
| frost | Slow +15 Punkte (Cap 70 %), Stun 20 % / 0,7 s |
| blast | Radius ×1,25, Pop 20 %, 10 Schaden, Radius 75 |
| electric | 30 % Chance, 3 Sprünge |

- UI: Coupons zeigen 4 Pips, aber nur die aktuelle und die nächste Stufe. Die Hover-Karte zeigt alle 3 Stufen.

**Doppelpack**
- Ab Shop 2 hat jedes Angebot (außer Legendäre) 8 % Chance, Preis ×1,5 (`ECONOMY.doublePackChance`, `doublePackPriceMult`).
- `double?: boolean` steht auf `ShopOffer` und `ItemInstance`. Das Item zählt doppelt fürs Familien-Set; `setGains` berücksichtigt das.
- "2×"-Sticker auf der Angebotskarte, Marker im Wagen und im Regal.

### B. Kampf
**Elite-Affixe** (`src/data/enemies.ts`, `src/scenes/enemies.ts`)
- **Swift:** Tempo ×1,4, Nachbild-Spur.
- **Tough:** 2 % max HP/s Regen nach 2 s ohne Treffer.
- **Splitter:** 2 Kopien mit 0,4 Größe und 0,4 HP. Nicht für melon, slice, honey und `ELITE_EXCLUDED`.
- **Pickpocket:** sucht Münzen im Umkreis von 170 px, sammelt sie ein, lässt sie beim Tod fallen.
- Krone, Aura in Affix-Farbe, Name über der HP-Leiste.

**Set-Events** (`src/data/events.ts`, `src/scenes/events.ts`)
- 12 % pro Gang ab Gang 2, nie Boss. Mit passendem Set ×3 so oft und der hilfreiche Teil ×1,5.
- Würfeln nur, wenn wetFloor/outage nicht kommen → max. 1 Event pro Gang.

| Event | Dauer | Effekt |
|---|---|---|
| happyHour (Snacks) | 15 s | +1 HP/s, Gegner-Tempo ×1,15 |
| heatwave (Heat) | 20 s | Branddauer ×1,5 |
| powerSurge (Electric) | 15 s | Elektro-Feuerrate ×1,5; Blitz alle 1,4 s, 0,9 s Telegraph, 2 Schaden (nur Spieler) |
| flashSale (Checkout) | 20 s | Kill-Münzen ×2 |
| freezerFail (Frost) | 20 s | Gegner 20 % langsamer, 4 Eisflächen, Spieler-Accel 3,2/s |

**Spezialräume** (neue Modifier `stockroom`, `coldRoom`, `vipAisle`)
- Ab Gang 3 wird jeder Nicht-Clearance-Türplatz mit 10 % Chance zum Raum. Max. 1 pro Auswahl, nie die Boss-Tür, Zone `null`.
- **Lager:** 0 Gegner, 3 Kisten. DOM-Overlay `src/ui/stockroom.ts` bietet 3 Gratis-Items (Klick oder Taste 1–3). Volles Regal → Münzen.
- **Kühlraum:** Gegnerzahl ×0,8, Münzen ×1,5, Gegner 25 % langsamer, Spieler-Accel 4,5/s.
- **VIP-Gang:** Gegnerzahl ×0,35, Münzen ×1,5, alle Spawns Elite.

### C. Meta
**Bons**
- `profile.history`: letzte 10 Runs, geschrieben von `recordFinish()` in `finish()`. Overtime aktualisiert den Sieg-Eintrag statt einen neuen anzulegen.
- Neuer Titel-Button öffnet ein Modal, das innen scrollt.

**Treuestempel**
- `profile.stamps`, `profile.coupons`: +1 pro Run, +2 bei Sieg. 10 Stempel → 1 Gutschein.
- Der nächste normale Run startet mit +20 Münzen.
- Stempelkarte auf dem Endscreen; String-Key `stampCard`.

**Tagesrun**
- Seed = FNV-Hash des lokalen Datums. Immer Toaster, Schicht 0, Theme main, ohne Gutschein.
- `startRun(..., {daily:true})` setzt `state.daily`; `profile.daily` speichert date, best und tries.
- Titel-Button zeigt den Tagesbestwert; "Shop again" startet den Tagesrun neu.

## Bekannte Vereinfachungen / TODO
- Lager-Kisten nutzen das Sprite `ob_tv_boxes` und können mit Hindernissen überlappen.
- Raum-Münz-Multiplikatoren gelten auch für den Wave-Clear-Bonus.
- Kampf-Zufall nutzt weiter `Math.random`. Der Tagesrun ist deshalb nur bei Zonen, Shops und Türen deterministisch.
- Playtest steht aus: alle neuen Features, Balance der L3-Werte, Lesbarkeit der Elite-Affixe, Endkarten-Höhe mit Stempelzeile.
- `npm test` laufen lassen und alte Set-Tests an Level 0–3 anpassen.

## Workflow-Notizen
- Haiku liest Code, Sonnet schreibt Code, Opus orchestriert. Vor jedem Schritt Erlaubnis holen.
- Bei UI erst Konzept/Mockup, dann Code.
- Commit/Push nur nach Ansage.
- Lab-Modus: `?lab`.
- Browser-Tests mit Vite-HMR: Module mit derselben `?t=`-URL importieren wie die App.
- Browser-Tests verändern das echte Profil in localStorage: vorher sichern.
