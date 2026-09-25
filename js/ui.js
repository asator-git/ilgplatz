// ---------------------------------------------------------------
// ui.js – DOM-Oberfläche: HUD, Dialoge, Menüs, Minispiele
// ---------------------------------------------------------------
'use strict';

const $ = (id) => document.getElementById(id);

const UI = {
  game: null,
  boot: null,
  dlg: null,         // aktueller Dialog
  dlgQueue: [],
  overlayMode: null, // 'title' | 'pause' | 'end' | 'minigame' | 'help'
  overlayKey: null,  // Tastatur-Handler des Overlays
  bannerTimer: null,
  lastHud: {},
  portraits: {},

  init(game, bootScene) {
    this.game = game;
    this.boot = bootScene;
    Input.handlers.ui = (ev, arg) => this.onInput(ev, arg);
    $('dialog').addEventListener('click', (e) => {
      if (e.target.classList.contains('opt')) return;
      this.advance();
    });
    $('btnMute').addEventListener('click', (e) => { e.preventDefault(); Sfx.toggleMute(); this.syncMute(); });
    $('btnMute').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); Sfx.unlock(); Sfx.toggleMute(); this.syncMute(); }, { passive: false });
    this.syncMute();
    // Portraits für Menüs vorbereiten
    for (const id of Object.keys(CHAR_STYLES)) this.portraits[id] = textureDataURL(bootScene, 'ch_' + id, 0, 4);
    this.portraits.mascha = textureDataURL(bootScene, 'mascha', 0, 4);
  },

  syncMute() { $('btnMute').classList.toggle('off', Sfx.muted); },

  // ---- Eingabe-Routing ----
  onInput(ev, arg) {
    if (this.overlayMode) {
      if (this.overlayKey) this.overlayKey(ev, arg);
      return true;
    }
    if (this.dlg) {
      const d = this.dlg;
      if (ev === 'pause') return false; // Pause geht auch im Dialog
      if (d.showingOptions) {
        const n = d.options.length;
        if (ev === 'up' || ev === 'left') { d.sel = (d.sel - 1 + n) % n; this.renderOptions(); }
        else if (ev === 'down' || ev === 'right') { d.sel = (d.sel + 1) % n; this.renderOptions(); }
        else if (ev === 'action' || ev === 'confirm') this.chooseOption(d.sel);
        else if (ev === 'num' && arg >= 1 && arg <= n) this.chooseOption(arg - 1);
        return true;
      }
      if (ev === 'action' || ev === 'confirm' || ev === 'special') this.advance();
      return true;
    }
    return false;
  },

  isBlocking() { return !!this.dlg || !!this.overlayMode; },
  isDialogOpen() { return !!this.dlg; },

  // ---- HUD ----
  showHUD(v) { $('hud').classList.toggle('hidden', !v); },

  updateHUD(st) {
    const set = (id, v) => { if (this.lastHud[id] !== v) { this.lastHud[id] = v; $(id).textContent = v; } };
    set('hudClock', clockStr(st.minute));
    set('hudRank', rankFor(st.rep));
    set('hudRep', T('ui.ansehen', { n: Math.round(st.rep) }, 'Ansehen: {n}'));
    set('hudMoney', euro(st.money));
    set('hudRival', T('ui.rivale', { name: st.rivalName, n: Math.round(st.rivalRep) }, '{name}: {n}'));
    $('hudRival').classList.toggle('behind', st.rep > st.rivalRep);
    const maxRep = Math.max(800, st.rivalRep + 100, st.rep + 50);
    $('hudRepBar').style.width = clamp(st.rep / maxRep * 100, 0, 100) + '%';
    set('hudStatus', st.status || '');
    const hb = $('hudHunger');
    if (st.hunger === null || st.hunger === undefined) hb.classList.add('hidden');
    else {
      hb.classList.remove('hidden');
      $('hudHungerBar').style.width = clamp(st.hunger, 0, 100) + '%';
      hb.classList.toggle('low', st.hunger < 25);
    }
    // Inventar
    const invKey = JSON.stringify(st.inv || {});
    if (this.lastHud.inv !== invKey) {
      this.lastHud.inv = invKey;
      const el = $('hudInv');
      el.innerHTML = '';
      for (const k in st.inv) {
        if (!st.inv[k]) continue;
        const img = document.createElement('img');
        img.src = this.itemIcon(k);
        img.title = T('items.' + k, null, k);
        el.appendChild(img);
        if (st.inv[k] > 1) { const c = document.createElement('span'); c.className = 'cnt'; c.textContent = st.inv[k]; el.appendChild(c); }
      }
    }
  },

  itemIcon(k) {
    if (!this._itemIcons) this._itemIcons = {};
    if (!this._itemIcons[k]) this._itemIcons[k] = textureDataURL(this.boot, this.boot.textures.exists('item_' + k) ? 'item_' + k : 'item_paket', undefined, 2);
    return this._itemIcons[k];
  },

  setQuests(list) {
    const key = JSON.stringify(list);
    if (this.lastHud.quests === key) return;
    this.lastHud.quests = key;
    const el = $('quests');
    el.innerHTML = '';
    list.slice(0, 3).forEach(q => {
      const d = document.createElement('div');
      d.className = 'quest' + (q.must ? ' must' : '');
      d.innerHTML = `<span><span class="qt">${escapeHtml(q.title)}:</span> ${escapeHtml(q.text)}</span>` + (q.timer ? `<span class="timer">${escapeHtml(q.timer)}</span>` : '');
      el.appendChild(d);
    });
    if (list.length > 3) {
      const d = document.createElement('div');
      d.className = 'quest'; d.textContent = T('ui.weitereAuftraege', { n: list.length - 3 }, '+{n} weitere');
      el.appendChild(d);
    }
  },

  setPrompt(text) {
    if (this.lastHud.prompt === text) return;
    this.lastHud.prompt = text;
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text;
    el.classList.remove('hidden');
  },

  setSpecialLabel(t) { const b = $('btnE'); if (b.textContent !== t) b.textContent = t; },

  toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  },

  banner(text, ms, cls) {
    const el = $('banner');
    el.className = cls || '';
    el.textContent = text;
    // Animation neu starten
    void el.offsetWidth;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.add('hidden'), ms || 4500);
  },

  sms(from, text, ms) {
    const el = document.createElement('div');
    el.className = 'sms';
    el.innerHTML = `<b>✉ SMS von ${escapeHtml(from)}</b>${escapeHtml(text)}`;
    $('ui').appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ms || 4500);
  },

  fade(text) { const f = $('fade'); f.textContent = text || ''; f.classList.remove('hidden'); },
  unfade() { $('fade').classList.add('hidden'); },

  // ---- Dialog ----
  // pages: [{who, text}] | string[]; opts: {options:[{label, fn, disabled}], onClose, who}
  dialog(pages, opts) {
    opts = opts || {};
    if (!Array.isArray(pages)) pages = [pages];
    pages = pages.map(p => typeof p === 'string' ? { who: opts.who || '', text: p } : p);
    const d = { pages, idx: 0, options: opts.options || null, onClose: opts.onClose || null, sel: 0, showingOptions: false, typing: false, full: '' };
    if (this.dlg) { this.dlgQueue.push(d); return; }
    this.openDialog(d);
  },

  openDialog(d) {
    this.dlg = d;
    document.body.classList.add('dialog-open');
    $('dialog').classList.remove('hidden');
    if (typeof G !== 'undefined' && G) G.dialogStartMs = G.realMs;
    this.showPage();
  },

  showPage() {
    const d = this.dlg;
    const p = d.pages[d.idx] || { who: '', text: '…' };
    $('dlgWho').textContent = p.who || '';
    $('dlgWho').style.display = p.who ? '' : 'none';
    $('dlgOpts').innerHTML = '';
    d.showingOptions = false;
    const last = d.idx >= d.pages.length - 1;
    $('dlgNext').style.display = (last && d.options) ? 'none' : '';
    // Schreibmaschine
    d.full = String(p.text || '');
    d.shown = 0; d.typing = true;
    $('dlgText').textContent = '';
    clearInterval(d.timer);
    const speed = 2;
    d.timer = setInterval(() => {
      d.shown = Math.min(d.full.length, d.shown + speed);
      $('dlgText').textContent = d.full.slice(0, d.shown);
      if (d.shown >= d.full.length) { clearInterval(d.timer); d.typing = false; if (last && d.options) this.showOptions(); }
    }, 16);
    Sfx.play('blip');
  },

  showOptions() {
    const d = this.dlg;
    if (!d || !d.options) return;
    d.showingOptions = true;
    d.sel = d.options.findIndex(o => !o.disabled);
    if (d.sel < 0) d.sel = 0;
    this.renderOptions();
  },

  renderOptions() {
    const d = this.dlg;
    const box = $('dlgOpts');
    box.innerHTML = '';
    d.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (i === d.sel ? ' sel' : '') + (o.disabled ? ' dis' : '');
      b.textContent = (i + 1) + '. ' + o.label;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.chooseOption(i); });
      b.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
      box.appendChild(b);
    });
  },

  chooseOption(i) {
    const d = this.dlg;
    if (!d || !d.options) return;
    const o = d.options[i];
    if (!o) return;
    if (o.disabled) { Sfx.play('bad'); if (o.why) this.toast(o.why, 'bad'); return; }
    Sfx.play('blip');
    this.closeDialog(true);
    try { if (o.fn) o.fn(); } catch (e) { console.error(e); }
  },

  advance() {
    const d = this.dlg;
    if (!d) return;
    if (d.typing) {
      clearInterval(d.timer); d.typing = false; d.shown = d.full.length;
      $('dlgText').textContent = d.full;
      if (d.idx >= d.pages.length - 1 && d.options) this.showOptions();
      return;
    }
    if (d.showingOptions) return;
    if (d.idx < d.pages.length - 1) { d.idx++; this.showPage(); return; }
    if (d.options) { this.showOptions(); return; }
    this.closeDialog(false);
  },

  closeDialog(viaOption) {
    const d = this.dlg;
    if (!d) return;
    clearInterval(d.timer);
    this.dlg = null;
    $('dialog').classList.add('hidden');
    document.body.classList.remove('dialog-open');
    if (d.onClose) { try { d.onClose(viaOption); } catch (e) { console.error(e); } }
    if (typeof G !== 'undefined' && G && G.onDialogClosed) G.onDialogClosed();
    if (!this.dlg && this.dlgQueue.length) {
      const n = this.dlgQueue.shift();
      setTimeout(() => { if (!this.dlg) this.openDialog(n); else this.dlgQueue.unshift(n); }, 60);
    }
  },

  closeAllDialogs() {
    this.dlgQueue = [];
    if (this.dlg) { clearInterval(this.dlg.timer); this.dlg = null; }
    $('dialog').classList.add('hidden');
    document.body.classList.remove('dialog-open');
  },

  // ---- Overlays ----
  showOverlay(html, mode, keyHandler, dim) {
    const o = $('overlay');
    o.innerHTML = html;
    o.classList.remove('hidden');
    o.classList.toggle('dim', !!dim);
    o.scrollTop = 0;
    this.overlayMode = mode;
    this.overlayKey = keyHandler || null;
  },
  hideOverlay() {
    const o = $('overlay');
    o.classList.add('hidden');
    o.innerHTML = '';
    this.overlayMode = null;
    this.overlayKey = null;
  },

  resetForTitle() {
    this.closeAllDialogs();
    this.hideOverlay();
    this.unfade();
    this.showHUD(false);
    $('banner').classList.add('hidden');
    $('toasts').innerHTML = '';
    document.querySelectorAll('.sms').forEach(e => e.remove());
    this.lastHud = {};
  },

  highscoreHTML() {
    const list = Highscore.load();
    if (!list.length) return `<p>${escapeHtml(T('ui.keineHighscores', null, 'Noch keine Einträge. Sei der Erste!'))}</p>`;
    return '<table class="hs">' + list.map((e, i) =>
      `<tr><td>${i + 1}.</td><td>${escapeHtml(e.name || '?')}</td><td>${escapeHtml(T('figuren.' + e.figur + '.name', null, e.figur || ''))}</td><td>${Math.round(e.ansehen || 0)}</td><td>${escapeHtml(e.rang || '')}</td><td>${e.sieg ? '★' : ''}</td></tr>`).join('') + '</table>';
  },

  showTitle() {
    this.resetForTitle();
    const cards = FIGUREN.map((id, i) => `
      <div class="card" data-id="${id}" data-i="${i}">
        <div class="top"><img src="${this.portraits[id] || ''}" alt="">${id === 'hubi' ? `<img src="${this.portraits.mascha}" style="width:40px;height:40px" alt="">` : ''}
          <div class="nm">${escapeHtml(T('figuren.' + id + '.name', null, id))}</div></div>
        <div class="info">${escapeHtml(T('figuren.' + id + '.info', null, ''))}</div>
        <div class="plus">+ ${escapeHtml(T('figuren.' + id + '.staerke', null, ''))}</div>
        <div class="minus">− ${escapeHtml(T('figuren.' + id + '.schwaeche', null, ''))}</div>
      </div>`).join('');
    const html = `<div class="menu">
      <div class="title">${escapeHtml(T('ui.titel', null, 'Bürgermeister vom Stuwerviertel'))}</div>
      <div class="subtitle">${escapeHtml(T('ui.untertitel', null, 'Ein Tag am Ilgplatz'))}</div>
      <div class="box" style="text-align:center">${escapeHtml(T('ui.waehleFigur', null, 'Wähle deine Figur:'))}</div>
      <div class="cards">${cards}</div>
      <div class="box"><h3>${escapeHtml(T('ui.steuerungTitel', null, 'Steuerung'))}</h3>${TL('ui.steuerung', ['Pfeiltasten/WASD: gehen', 'Leertaste: Aktion', 'E: Spezial', 'Esc: Pause']).map(escapeHtml).join('<br>')}</div>
      <div class="box"><h3>${escapeHtml(T('ui.highscoreTitel', null, 'Highscores'))}</h3>${this.highscoreHTML()}</div>
      <div class="box" style="text-align:center"><button class="bigbtn alt" id="tMute">${Sfx.muted ? '♪ Ton: aus' : '♪ Ton: an'}</button></div>
    </div>`;
    let sel = 0;
    const mark = () => document.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('sel', i === sel));
    this.showOverlay(html, 'title', (ev) => {
      if (ev === 'left' || ev === 'up') { sel = (sel + FIGUREN.length - 1) % FIGUREN.length; mark(); }
      if (ev === 'right' || ev === 'down') { sel = (sel + 1) % FIGUREN.length; mark(); }
      if (ev === 'action' || ev === 'confirm') { Sfx.play('good'); startGame(FIGUREN[sel]); }
    });
    mark();
    document.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => { Sfx.unlock(); Sfx.play('good'); startGame(c.dataset.id); }));
    const m = $('tMute');
    if (m) m.addEventListener('click', () => { Sfx.unlock(); Sfx.toggleMute(); this.syncMute(); m.textContent = Sfx.muted ? '♪ Ton: aus' : '♪ Ton: an'; });
  },

  helpHTML() {
    return `<div class="box"><h3>${escapeHtml(T('ui.anleitungTitel', null, 'Anleitung'))}</h3>${TL('ui.anleitung', ['Sammle Ansehen. Um 23:00 musst du mehr haben als dein Rivale.']).map(escapeHtml).join('<br><br>')}</div>`;
  },

  showPause(onResume, onRestart) {
    const html = `<div class="menu">
      <div class="title">${escapeHtml(T('ui.pause', null, 'Pause'))}</div>
      <button class="bigbtn" id="pResume">${escapeHtml(T('ui.weiter', null, 'Weiter'))}</button>
      <button class="bigbtn alt" id="pHelp">${escapeHtml(T('ui.anleitungTitel', null, 'Anleitung'))}</button>
      <button class="bigbtn alt" id="pRestart">${escapeHtml(T('ui.neustart', null, 'Neustart'))}</button>
      <div id="pHelpBox"></div></div>`;
    this.showOverlay(html, 'pause', (ev) => {
      if (ev === 'pause' || ev === 'confirm') { this.hideOverlay(); onResume(); }
    }, true);
    $('pResume').addEventListener('click', () => { this.hideOverlay(); onResume(); });
    $('pHelp').addEventListener('click', () => { $('pHelpBox').innerHTML = this.helpHTML(); });
    $('pRestart').addEventListener('click', () => { this.hideOverlay(); onRestart(); });
  },

  showEnd(res, onAgain) {
    const win = res.win;
    this.showHUD(false);
    this.setPrompt(null);
    const html = `<div class="menu">
      <div class="title">${escapeHtml(win ? T('ende.sieg', null, 'BÜRGERMEISTER VOM STUWERVIERTEL!') : T('ende.niederlage', null, 'Knapp daneben…'))}</div>
      <div id="endArt" style="font-size:40px;margin:8px">${win ? '🏅' : '☕'}</div>
      <div class="big">${escapeHtml(T('ende.vergleich', { du: Math.round(res.rep), rivale: res.rivalName, r: Math.round(res.rivalRep) }, 'Du: {du} – {rivale}: {r}'))}</div>
      <div class="box">${escapeHtml(res.text)}</div>
      <div class="box">${escapeHtml(T('ende.statistik', { n: res.questsDone, rang: res.rank }, 'Aufträge erledigt: {n} · Rang: {rang}'))}</div>
      <div class="box" style="text-align:center">${escapeHtml(T('ende.nameEingeben', null, 'Dein Name für die Highscore-Liste:'))}<br><br>
        <input class="name" id="hsName" maxlength="14" value="${escapeHtml(res.defaultName)}"> <button class="bigbtn" id="hsSave">${escapeHtml(T('ende.speichern', null, 'Eintragen'))}</button>
      </div>
      <div class="box" id="hsBox"><h3>${escapeHtml(T('ui.highscoreTitel', null, 'Highscores'))}</h3>${this.highscoreHTML()}</div>
      <button class="bigbtn" id="endAgain">${escapeHtml(T('ende.nochmal', null, 'Nochmal – mit anderer Figur'))}</button>
    </div>`;
    this.showOverlay(html, 'end', (ev) => { if (ev === 'confirm' && document.activeElement !== $('hsName')) onAgain(); });
    if (res.artHtml) $('endArt').innerHTML = res.artHtml;
    let saved = false;
    const save = () => {
      if (saved) return;
      saved = true;
      const name = ($('hsName').value || res.defaultName).slice(0, 14);
      Highscore.add({ name, ansehen: Math.round(res.rep), rang: res.rank, figur: res.figur, sieg: win });
      $('hsBox').innerHTML = `<h3>${escapeHtml(T('ui.highscoreTitel', null, 'Highscores'))}</h3>${this.highscoreHTML()}`;
      $('hsSave').disabled = true;
    };
    $('hsSave').addEventListener('click', save);
    $('hsName').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); e.stopPropagation(); });
    $('endAgain').addEventListener('click', () => { save(); onAgain(); });
  },

  // ---- Minispiel: Schrauben in Reihenfolge ----
  minigameScrews(cb) {
    const n = B('minispiele.schraubenAnzahl', 5);
    let time = B('minispiele.schraubenSekunden', 20);
    const html = `<div class="mg"><h2>${escapeHtml(T('minispiele.schrauben.titel', null, 'Schrauben in der richtigen Reihenfolge!'))}</h2>
      <div>${escapeHtml(T('minispiele.schrauben.hilfe', null, 'Tippe 1 bis 5 der Reihe nach an (oder Tasten 1–5).'))}</div>
      <div class="mgtimer" id="mgT">${time}</div><div class="mgarea" id="mgA"></div></div>`;
    let next = 1, done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      clearInterval(iv);
      if (this.overlayMode !== 'minigame' || (G && G.ended)) return;
      this.hideOverlay();
      Sfx.play(ok ? 'good' : 'bad');
      cb(ok);
    };
    const hit = (k) => {
      if (done) return;
      if (k === next) {
        Sfx.play('blip');
        const el = document.querySelector(`.screw[data-n="${k}"]`);
        if (el) el.classList.add('done');
        next++;
        if (next > n) finish(true); else place();
      } else { Sfx.play('bad'); time = Math.max(0, time - 2); }
    };
    this.showOverlay(html, 'minigame', (ev, arg) => { if (ev === 'num') hit(arg); }, true);
    const area = $('mgA');
    const place = () => {
      // Positionen neu würfeln (nicht erledigte)
      const W = area.clientWidth - 50, H = area.clientHeight - 50;
      document.querySelectorAll('.screw').forEach(s => {
        if (s.classList.contains('done')) return;
        s.style.left = Math.floor(Math.random() * W) + 'px';
        s.style.top = Math.floor(Math.random() * H) + 'px';
      });
    };
    for (let i = 1; i <= n; i++) {
      const s = document.createElement('div');
      s.className = 'screw'; s.dataset.n = i; s.textContent = i;
      const h = (e) => { e.preventDefault(); e.stopPropagation(); hit(i); };
      s.addEventListener('mousedown', h);
      s.addEventListener('touchstart', h, { passive: false });
      area.appendChild(s);
    }
    place();
    const iv = setInterval(() => {
      if (G && G.paused) return;
      time -= 0.1;
      const t = $('mgT');
      if (t) t.textContent = Math.max(0, Math.ceil(time)) + ' s';
      if (time <= 0) finish(false);
    }, 100);
  },

  // ---- Minispiel: Tastenfolge (Hacken) ----
  minigameHack(cb) {
    const len = B('minispiele.hackLaenge', 6);
    let time = B('minispiele.hackSekunden', 9);
    const dirs = ['up', 'down', 'left', 'right'];
    const sym = { up: '↑', down: '↓', left: '←', right: '→' };
    const seq = []; for (let i = 0; i < len; i++) seq.push(pick(dirs));
    let pos = 0, done = false;
    const html = `<div class="mg"><h2>${escapeHtml(T('minispiele.hack.titel', null, 'Terminal hacken'))}</h2>
      <div>${escapeHtml(T('minispiele.hack.hilfe', null, 'Tipp die Pfeilfolge nach!'))}</div>
      <div class="mgtimer" id="mgT">${time}</div>
      <div class="seq" id="mgS">${seq.map((d, i) => `<span data-i="${i}">${sym[d]}</span>`).join('')}</div>
      <div class="arrows"><span></span><button data-d="up">↑</button><span></span><button data-d="left">←</button><button data-d="down">↓</button><button data-d="right">→</button></div></div>`;
    const render = () => document.querySelectorAll('#mgS span').forEach((s, i) => { s.className = i < pos ? 'ok' : (i === pos ? 'cur' : ''); });
    const finish = (ok) => { if (done) return; done = true; clearInterval(iv); if (this.overlayMode !== 'minigame' || (G && G.ended)) return; this.hideOverlay(); Sfx.play(ok ? 'good' : 'bad'); cb(ok); };
    const press = (d) => {
      if (done) return;
      if (seq[pos] === d) { pos++; Sfx.play('type'); render(); if (pos >= len) finish(true); }
      else { pos = 0; Sfx.play('bad'); render(); }
    };
    this.showOverlay(html, 'minigame', (ev) => { if (dirs.includes(ev)) press(ev); }, true);
    document.querySelectorAll('.arrows button').forEach(b => {
      const h = (e) => { e.preventDefault(); e.stopPropagation(); press(b.dataset.d); };
      b.addEventListener('mousedown', h); b.addEventListener('touchstart', h, { passive: false });
    });
    render();
    const iv = setInterval(() => {
      if (G && G.paused) return;
      time -= 0.1;
      const t = $('mgT'); if (t) t.textContent = Math.max(0, Math.ceil(time)) + ' s';
      if (time <= 0) finish(false);
    }, 100);
  }
};
