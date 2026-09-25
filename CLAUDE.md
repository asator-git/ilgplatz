# Bürgermeister vom Stuwerviertel – Projektkontext

Browser-Spiel (Top-down, Zelda-artig, Pixelart) über einen Tag am **Ilgplatz** (Stuwerviertel, Wien 2).
08:00–23:00 Spielzeit (1 Spielstunde = 240 s Echtzeit). Spieler sammelt **Ansehen** durch Aufträge,
weicht Exen / Erwin / Marco / Kiwara aus. Um 23:00: mehr Ansehen als der Rivale (Hubi, bzw. Andi wenn
man Hubi spielt) → „Bürgermeister vom Stuwerviertel". Ton: Wiener Schmäh, derb, liebevoll gemein.
Auftraggeber ist Andreas (kein Programmierer) – keine Rückfragen, einfache robuste Lösungen.

## Tech-Regeln (verbindlich)
- Phaser 3.80.1 per CDN, **kein Bundler / kein npm-Build**. Plain JS-Dateien per `<script>`.
- **Alle Texte** in `data/dialoge.json`, **alle Zahlen** in `data/balance.json`.
  Zugriff nur über `T('pfad', vars, fallback)` und `B('pfad', default)` (js/util.js) → nie Crash bei fehlenden Einträgen.
- Keine externen Grafiken/Sounds: Sprites werden in `js/textures.js` zur Laufzeit gezeichnet, Sounds in `js/audio.js` per Web Audio.
- HUD, Dialoge, Menüs, Minispiele und Touch-Steuerung sind **DOM-Overlay** (`js/ui.js`, `css/style.css`), die Welt ist Phaser.
- Speichern: nur Highscore in `localStorage` (try/catch).
- Deutsch mit Umlauten, Font „Press Start 2P" (Fallback monospace).

## Ordnerstruktur
```
index.html          Einstieg, lädt Phaser + js/*
css/style.css       Overlay-UI
data/dialoge.json   ALLE Texte (Dialoge, Aufträge, Events, UI) – Deutsch (Standard)
data/dialoge_en.json  dieselben Texte auf Englisch (gleiche Struktur! neue Schlüssel immer in beiden anlegen)
data/balance.json   ALLE Zahlen (Zeiten, Punkte, Preise)
js/util.js          T(), B(), Helfer, globaler Spielzustand G
js/audio.js         Soundeffekte (Web Audio)
js/textures.js      Pixelart-Generierung
js/map.js           Karte (40×40), Kollision, Wegfindung (A*), Orte
js/input.js         Tastatur + virtueller Joystick
js/ui.js            DOM-UI (HUD, Dialog, Menüs, Minispiele)
js/actors.js        Figuren/NPC-Basis, Zustände, Bewegung
js/enemies.js       Gegner-KI (Exen, Nadja, Erwin, Marco, Kiwara, Autos, Events-Figuren)
js/quests.js        Alle Aufträge
js/events.js        Fixe Tages-Events
js/world.js         WorldScene (Hauptszene)
js/main.js          Boot, Phaser-Konfiguration
tools/smoke.mjs     Headless-Test (Playwright, optional)
```

## Testen
- `node --check js/*.js`, JSON validieren.
- Lokal starten: `python3 -m http.server 8000` → http://localhost:8000
- Debug-URL-Parameter: `?figur=hubi&speed=30` (Autostart + Zeitraffer), `?start=14:00`.
- Headless: `node tools/smoke.mjs` (braucht Playwright in /tmp/pwtest).

## Deployment
Vor jedem Commit `python3 tools/stamp.py` ausführen (Versionsnummer an allen Dateien → kein alter Browser-Cache).

GitHub Pages aus `main` (Root). `.nojekyll` vorhanden.
