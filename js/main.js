// ---------------------------------------------------------------
// main.js – Boot, Phaser-Konfiguration, Skalierung
// ---------------------------------------------------------------
'use strict';

function viewSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, window.innerWidth || 800), h = Math.max(320, window.innerHeight || 600);
  return { w: Math.round(w * dpr), h: Math.round(h * dpr), dpr };
}

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const v = window.ASSET_V ? '?v=' + window.ASSET_V : '';
    this.load.json('dialoge', 'data/dialoge.json' + v);
    this.load.json('balance', 'data/balance.json' + v);
    this.load.on('loaderror', (f) => { console.warn('Konnte nicht laden:', f && f.key); });
  }
  create() {
    DATA.dialoge = this.cache.json.get('dialoge') || {};
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

function startGame(figur) {
  const game = window.GAME;
  UI.hideOverlay();
  if (game.scene.isActive('World') || game.scene.isPaused('World')) game.scene.stop('World');
  game.scene.start('World', { figur });
}

function backToTitle() {
  const game = window.GAME;
  if (game.scene.isActive('World') || game.scene.isPaused('World')) game.scene.stop('World');
  UI.resetForTitle();
  UI.showTitle();
}

window.addEventListener('load', () => {
  const s = viewSize();
  const config = {
    type: Phaser.AUTO,
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
  } catch (e) {
    const el = document.getElementById('loading');
    if (el) el.textContent = 'Fehler beim Start: ' + e.message;
    return;
  }
  Input.init();
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
