// ---------------------------------------------------------------
// music.js – Hintergrundmusik über den offiziellen YouTube-Player
// (Video-ID und Titel in data/balance.json → "musik")
// ---------------------------------------------------------------
'use strict';

const Music = {
  on: false,
  player: null,
  ready: false,
  apiLoading: false,
  failed: false,

  init() {
    try { this.wanted = window.localStorage.getItem('ilgplatz_musik') === '1'; } catch (e) { this.wanted = false; }
    const b = document.getElementById('btnMusic');
    if (b) {
      b.addEventListener('click', (e) => { e.preventDefault(); this.toggle(); });
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.toggle(); }, { passive: false });
    }
    this.sync();
  },

  videoId() { return B('musik.youtubeId', 'FIQAlpVSRcc'); },
  title() { return B('musik.titel', 'Der Nino aus Wien – Praterlied'); },

  label() { return (this.on ? '♫ ' + T('musik.an', null, 'Musik: an') : '♫ ' + T('musik.aus', null, 'Musik: aus')) + ' (' + this.title() + ')'; },

  sync() {
    const b = document.getElementById('btnMusic');
    if (b) b.classList.toggle('off', !this.on);
    const box = document.getElementById('musicBox');
    if (box) box.classList.toggle('hidden', !this.on);
    document.querySelectorAll('.musicToggle').forEach(el => { el.textContent = this.label(); });
  },

  save() { try { window.localStorage.setItem('ilgplatz_musik', this.on ? '1' : '0'); } catch (e) { /* egal */ } },

  toggle() { if (this.on) this.stop(); else this.start(); },

  // Beim ersten Klick im Spiel automatisch starten, wenn zuletzt eingeschaltet
  resumeIfWanted() { if (this.wanted && !this.on && !this.failed) this.start(); },

  start() {
    this.on = true; this.wanted = true; this.save(); this.sync();
    if (this.ready && this.player) { try { this.player.playVideo(); } catch (e) { /* egal */ } return; }
    this.loadApi(() => this.createPlayer());
  },

  stop() {
    this.on = false; this.wanted = false; this.save(); this.sync();
    if (this.player && this.ready) { try { this.player.pauseVideo(); } catch (e) { /* egal */ } }
  },

  loadApi(cb) {
    if (window.YT && window.YT.Player) { cb(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) { /* egal */ } cb(); };
    if (this.apiLoading) return;
    this.apiLoading = true;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => this.fail(T('musik.keinNetz', null, 'YouTube ist nicht erreichbar – keine Musik.'));
    document.head.appendChild(s);
  },

  createPlayer() {
    if (this.player) return;
    const id = this.videoId();
    try {
      this.player = new YT.Player('ytPlayer', {
        width: 200, height: 113, videoId: id,
        playerVars: { autoplay: 1, loop: 1, playlist: id, controls: 1, modestbranding: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e) => {
            this.ready = true;
            try { e.target.setVolume(B('musik.lautstaerke', 45)); if (this.on) e.target.playVideo(); } catch (err) { /* egal */ }
          },
          onError: (e) => {
            const blocked = e && (e.data === 101 || e.data === 150);
            this.fail(blocked ? T('musik.gesperrt', null, 'Das Lied darf leider nicht eingebettet werden.') : T('musik.fehler', null, 'Musik konnte nicht geladen werden.'));
          }
        }
      });
    } catch (e) { this.fail(T('musik.fehler', null, 'Musik konnte nicht geladen werden.')); }
  },

  fail(msg) {
    this.failed = true;
    this.on = false; this.sync();
    try { UI.toast(msg, 'bad'); } catch (e) { /* egal */ }
    const box = document.getElementById('musicBox');
    if (box) box.classList.add('hidden');
  }
};
