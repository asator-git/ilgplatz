# Bürgermeister vom Stuwerviertel – Ein Tag am Ilgplatz

Ein Pixelart-Browserspiel über einen Tag am Ilgplatz (Stuwerviertel, 2. Bezirk, Wien).
08:00 bis 23:00 Spielzeit (1 Spielstunde = 4 Minuten, ganzer Tag ≈ 1 Stunde).
Sammle **Ansehen** im Grätzl – um 23:00 musst du mehr haben als der Titelverteidiger Hubi
(bzw. Andi, wenn du Hubi spielst). Dann bist du **Bürgermeister vom Stuwerviertel**.

## Spielen

- **Online:** siehe GitHub-Pages-Link im Repo (Settings → Pages).
- **Lokal:** Im Ordner `python3 -m http.server 8000` ausführen und <http://localhost:8000> öffnen.
  (Direkt per Doppelklick auf `index.html` geht's nicht, weil der Browser die JSON-Dateien dann blockiert.)

## Die Karte

Nach der echten Lage (OpenStreetMap): Hillerstraße nach Nordost (dort der Deewan), Feuerbachstraße nach Nordwest,
Obermüllnerstraße nach Westen Richtung Praterstern („Stern“, ganz am Rand), Schrotzbergstraße nach Süden.
Dezentral im Norden, The Good Coffee Society im Osten, gleich daneben das Clown-Museum,
Radbande und Schlosserei (Ilgplatz 1 und 2) im Südwesten. Im Südosten Maler Slady, Pizzeria Maradona und
Buffalo Hot Wings (Schrotzbergstraße 1). Zwischen Café und Museum: Hubis Büro und – in der Ecke – das echte Klo.

## Steuerung

| | PC | Handy |
|---|---|---|
| Gehen | Pfeiltasten / WASD | Joystick links unten |
| Aktion / Reden / weiter | Leertaste | roter Knopf **A** |
| Spezialfähigkeit | **E** | blauer Knopf |
| Pause | Esc | **II** oben rechts |
| Musik an/aus | ♫ oben rechts oder am Startbildschirm | ♫ |
| Dialog-Antwort | Pfeile + Leertaste oder Zahl 1–9 | antippen |

## Speichern

Das Spiel speichert automatisch (alle 20 Sekunden und beim Pausieren) – im Pausemenü gibt's zusätzlich
„Spielstand speichern“. Beim nächsten Öffnen erscheint am Startbildschirm **„▶ Weiterspielen“**.
Ein Speicherplatz pro Browser/Gerät; nach 23:00 (Abrechnung) wird der Stand gelöscht.

## So geht's

- Leute mit gelbem **!** haben Aufträge. Unten stehen deine offenen Aufträge (max. 3), der gelbe Pfeil zeigt zum nächsten Ziel.
- Tratschen bringt +2 Ansehen (einmal pro Stunde pro Person). Die Uhr läuft **immer** – auch in Gesprächen.
- Gefahren: Hubis Exen (halten Hubi fest), Nadja (ab 14 Uhr), Erwin (Versteinerungsbalken!),
  Marco (schiebt dich weg – oder du heuerst ihn an), die Kiwara (ab 19 Uhr, hassen Pakete), Autos im Kreisverkehr
  (am Zebrastreifen bleiben sie stehen). Geh nie ganz ohne Geld ins Café.
- Versteinerte, grantige und benommene Leute heilt nur **Mascha** (Hubis Hund). Wer nicht Hubi ist, holt Hubi als Begleiter.

### Figuren

| Figur | Stärke | Schwäche |
|---|---|---|
| Hubi | Mascha: bellen (Exen fliehen) / kuscheln (heilt) | Exen jagen ihn, Nadja auch |
| Andi | +50 % Ansehen aus Gesprächen | Hungerbalken – leer = grantig |
| Carla | Niederquasseln (30 Sek. wehrlos) | Verliert Sachen, glaubt falschen Hinweisen |
| Juliette | +25 % auf Aufträge, 1 Gratis-Kaffee | Gespräche kosten doppelt Zeit |
| Markus | Terminals hacken (Minispiel) | Bleibt an Bildschirmen hängen |
| Jewi | Foto friert Gegner ein, Beweisfotos | Daniel verlangt 50 % mehr |

### Extra-Spiele

- **Bernd, der Dezentral-Drache:** Sprichst du ihn zu oft an oder gehst zu oft an ihm vorbei (manchmal auch einfach so),
  wird er todesgrantig und speit 30 Sekunden lang Feuerbälle. Ausweichen! Im Café bist du sicher.
- **Marco dreht durch:** Am späten Nachmittag trinkt Marco beim Buffalo zu viel Bier und schmeißt mit Flaschen.
  Die Kiwara geben dir eine Wasserpistole mit Eiswasser – kühl ihn ab (8 Treffer), bis er seinen Rausch ausschläft.
- **Radl-Notdienst (Didi):** Schrauben lockern sich am Rad – rechtzeitig antippen / Taste 1–6.
- **Hilf Ulli bei willhaben:** Drei Sachen am Stadtrand abholen und im richtigen Moment feilschen.
- **Klo-Held:** Café-Gäste wollen in Hubis Büro aufs Klo – zeig ihnen das echte, Hubi ist dir ewig dankbar.
- **Slady:** Leiter halten (ruhig stehen bleiben).

### Tagesablauf

10:40 Americano-Countdown (sonst Erdbeben!) · 12:30 Andi hat Hunger · 14:00 Nadja ·
15:00 Erwins Gipsy-Konzert · 17:00 Doppler-Frau · 19:00 Rückkehr der Zuhälter ·
21:00 Nacht (Dezentral offen, Kiwara doppelt) · 22:00 Finale (Kleber ab 450 Ansehen) · 23:00 Abrechnung.

## Sprache / Language

Standard ist Deutsch. Am Startbildschirm oben kann man auf **English** umschalten (wird gemerkt).
Direkter Link zur englischen Version: `…/ilgplatz/?lang=en`

## Texte & Zahlen ändern (ohne Programmieren)

- **Alle Texte / Dialoge / Schmäh:** `data/dialoge.json` (Deutsch) und `data/dialoge_en.json` (Englisch – gleicher Aufbau)
  Einfach die Sätze zwischen den Anführungszeichen ändern. Listen `[ "…", "…" ]` = mehrere Varianten.
  Platzhalter wie `{preis}`, `{rivale}`, `{spieler}`, `{name}` bitte stehen lassen.
- **Alle Zahlen (Zeiten, Punkte, Preise):** `data/balance.json`
- Nach dem Ändern prüfen, ob die Datei noch gültiges JSON ist (z. B. auf jsonlint.com). Fehlende Einträge
  crashen das Spiel nicht – dann steht halt ein Ersatztext da.

## Musik

Hintergrundmusik: „Praterlied“ von Der Nino aus Wien, abgespielt über den offiziellen YouTube-Player
(kleines Fenster oben rechts, braucht Internet). Anderes Lied: in `data/balance.json` unter `musik` die
`youtubeId` (der Teil nach `watch?v=` im YouTube-Link) und den `titel` ändern.

## Technik

Phaser 3.80.1 (CDN), kein Build-Schritt. Alle Grafiken werden zur Laufzeit als Pixelart erzeugt,
alle Sounds per Web Audio synthetisiert. Gespeichert wird nur die Highscore-Liste (localStorage).
Debug: `?figur=hubi&speed=30&start=14:00` (Autostart, Zeitraffer, Startzeit).
Headless-Test: `node tools/smoke.mjs "figur=hubi&speed=60" 66` (braucht Playwright).
