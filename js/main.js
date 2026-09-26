// ---------------------------------------------------------------
// main.js – Boot, Phaser-Konfiguration, Skalierung
// ---------------------------------------------------------------
'use strict';

// Android-Geräte haben oft hochauflösende Displays, aber wenig Grafikspeicher → sparsamer rendern
function viewSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, IS_ANDROID ? 1.5 : 2);
  const w = Math.max(320, window.innerWidth || 800), h = Math.max(320, window.innerHeight || 600);
  return { w: Math.round(w * dpr), h: Math.round(h * dpr), dpr };
}

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const v = window.ASSET_V ? '?v=' + window.ASSET_V : '';
    this.load.json('dialoge', 'data/dialoge.json' + v);
    this.load.json('dialoge_en', 'data/dialoge_en.json' + v);
    this.load.json('balance', 'data/balance.json' + v);
    this.load.on('loaderror', (f) => { console.warn('Konnte nicht laden:', f && f.key); });
  }
  create() {
    DATA.texte.de = this.cache.json.get('dialoge') || {};
    DATA.texte.en = this.cache.json.get('dialoge_en') || {};
    Lang.init();
    DATA.balance = this.cache.json.get('balance') || {};
    const go = () => {
      generateAllTextures(this);
      UI.init(this.game, this);
      const el = document.getElementById('loading');
      if (el) el.classList.add('hidden');
      if (URLP.figur && FIGUREN.includes(URLP.figur)) startGame(URLP.figur);
      else UI.showTitle();
    };
    // Auf den Pixel-Font warten (max. 2,5 s), damit Labels richtig aussehen
    let done = false;
    const once = () => { if (!done) { done = true; go(); } };
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('8px "Press Start 2P"').then(once, once);
        setTimeout(once, 2500);
      } else once();
    } catch (e) { once(); }
  }
}

const FIGUREN = ['hubi', 'andi', 'carla', 'juliette', 'markus', 'jewi'];

function startGame(figur, save) {
  const game = window.GAME;
  UI.hideOverlay();
  if (game.scene.isActive('World') || game.scene.isPaused('World')) game.scene.stop('World');
  game.scene.start('World', { figur, save: save || null });
}

function backToTitle() {
  const game = window.GAME;
  if (game.scene.isActive('World') || game.scene.isPaused('World')) game.scene.stop('World');
  UI.resetForTitle();
  UI.showTitle();
}

// Merkt sich, wenn WebGL am Gerät schon einmal abgestürzt ist → dann gleich Canvas verwenden
function safeCanvas() { try { return window.localStorage.getItem('ilgplatz_canvas') === '1'; } catch (e) { return false; } }

// Sichtbare Fehlermeldung statt schwarzem Bildschirm
function showFatal(msg) {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.remove('hidden');
  el.style.flexDirection = 'column'; el.style.padding = '20px'; el.style.textAlign = 'center'; el.style.lineHeight = '1.8';
  el.innerHTML = '<div>Hoppla / Oops!</div><div style="font-size:10px;color:#fff8e7;margin:12px 0">' + escapeHtml(msg) + '</div>'
    + '<button class="bigbtn" onclick="try{localStorage.setItem(\'ilgplatz_canvas\',\'1\')}catch(e){};location.reload()">Neu laden / Reload</button>';
}
window.addEventListener('error', (e) => { if (!window.GAME || !window.GAME.isBooted) showFatal((e && e.message) || 'Fehler beim Start'); });

window.addEventListener('load', () => {
  const s = viewSize();
  const config = {
    // ?renderer=canvas erzwingt die einfache Darstellung (falls WebGL am Gerät Probleme macht)
    type: (URLP.renderer === 'canvas' || safeCanvas()) ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1b1b2f',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: s.w, height: s.h },
    input: { activePointers: 3 },
    audio: { noAudio: true },
    scene: [BootScene, WorldScene]
  };
  try {
    window.GAME = new Phaser.Game(config);
    // WebGL-Kontext verloren (typisch Android beim App-Wechsel): speichern und neu laden
    window.GAME.events.once('ready', () => {
      const c = window.GAME.canvas;
      if (!c) return;
      c.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        try { if (window.WORLD) SaveGame.save(window.WORLD); } catch (err) { /* egal */ }
        try { window.localStorage.setItem('ilgplatz_canvas', '1'); } catch (err) { /* egal */ }
        setTimeout(() => location.reload(), 300);
      }, false);
    });
  } catch (e) {
    const el = document.getElementById('loading');
    if (el) el.textContent = 'Fehler beim Start: ' + e.message;
    return;
  }
  Input.init();
  setTimeout(() => { const el = document.getElementById('loading'); if (el && !el.classList.contains('hidden')) showFatal('Das Spiel lädt nicht. Bitte Internet prüfen und neu laden. / The game does not load – check your connection and reload.'); }, 15000);
  let rt = null;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const v = viewSize();
      try {
        window.GAME.scale.setGameSize(v.w, v.h);
        const w = window.GAME.scene.getScene('World');
        if (w && w.sys && w.sys.isActive()) w.applyZoom();
      } catch (e) { /* egal */ }
    }, 120);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
});
