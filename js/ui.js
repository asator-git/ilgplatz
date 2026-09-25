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
    if (typeof Music !== 'undefined') Music.init();
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
    set('hudMoney', euro(st.money));
    // Tagesfortschritt
    const dayFrac = clamp((st.minute - st.startMinute) / (st.endMinute - st.startMinute), 0, 1);
    $('hudDayBar').style.width = (dayFrac * 100) + '%';
    const left = Math.max(0, st.endMinute - st.minute);
    set('hudDayText', T('ui.nochZeit', { h: Math.floor(left / 60), m: String(Math.floor(left % 60)).padStart(2, '0') }, 'noch {h}:{m} h'));
    // Rang + nächster Rang
    set('hudRank', T('ui.rang', { rang: rankFor(st.rep) }, 'Rang: {rang}') + (st.nextRank ? ' · ' + st.nextRank : ''));
    set('hudNext', st.nextEvent || '');
    // Duell
    const me = Math.round(st.rep), ri = Math.round(st.rivalRep);
    set('duelMe', T('ui.du', { n: me }, 'Du: {n}'));
    set('duelRival', T('ui.rivale', { name: st.rivalName, n: ri }, '{name}: {n}'));
    $('duelMeBar').style.width = clamp(me / Math.max(1, me + ri) * 100, 2, 98) + '%';
    const diff = me - ri;
    set('duelInfo', diff > 0 ? T('ui.fuehrung', { n: diff, rivale: st.rivalName }, 'Du führst mit {n}! Halt durch bis 23:00.')
      : T('ui.rueckstand', { n: -diff, rivale: st.rivalName }, 'Dir fehlen {n} Ansehen auf {rivale} – mach Aufträge!'));
    $('duel').classList.toggle('lead', diff > 0);
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
      d.className = 'quest' + (q.must ? ' must' : '') + (q.now ? ' now' : '');
      if (q.now) {
        d.innerHTML = `<div class="qhead"><span>${escapeHtml(T('ui.aktuellerAuftrag', null, 'Aktueller Auftrag'))}</span>` + (q.timer ? `<span class="timer">⏱ ${escapeHtml(q.timer)}</span>` : '') + `</div>`
          + `<div class="qt">${escapeHtml(q.title)}</div><div class="qtext">${escapeHtml(q.text)}</div>`;
      } else {
        d.innerHTML = `<span><span class="qt">${escapeHtml(q.title)}:</span> ${escapeHtml(q.text)}</span>` + (q.timer ? `<span class="timer">${escapeHtml(q.timer)}</span>` : '');
      }
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

  // Große Einblendung bei Ansehen-Änderungen
  pop(text, cls) {
    const el = $('pop');
    el.className = cls || '';
    el.textContent = text;
    void el.offsetWidth;
    el.classList.remove('hidden');
    const d = $('duel'); d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
    clearTimeout(this.popTimer);
    this.popTimer = setTimeout(() => el.classList.add('hidden'), 1700);
  },

  // Warte-Anzeige (statt schwarzem Bildschirm)
  showWait(o) {
    $('waitTitle').textContent = o.title || '';
    $('waitText').textContent = o.text || '';
    $('waitHint').textContent = o.hint || '';
    $('wait').classList.toggle('dark', !!o.dark);
    $('wait').classList.remove('hidden');
    this.waitShown = true;
  },
  updateWait(frac, text) {
    $('waitBar').style.width = clamp(frac * 100, 0, 100) + '%';
    if (text !== undefined && this.lastWaitText !== text) { this.lastWaitText = text; $('waitText').textContent = text; }
  },
  hideWait() { if (this.waitShown) { $('wait').classList.add('hidden'); this.waitShown = false; this.lastWaitText = null; } },

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
    this.hideWait();
    $('pop').classList.add('hidden');
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
      ${DATA.dialoge && DATA.dialoge.ui ? '' : '<div class="box" style="color:#ef476f">Achtung: Die Texte (data/dialoge.json) konnten nicht geladen werden. Starte das Spiel bitte über einen Webserver, z. B. im Ordner: python3 -m http.server 8000 → http://localhost:8000</div>'}
      <div class="box" style="text-align:center">${escapeHtml(T('ui.waehleFigur', null, 'Wähle deine Figur:'))}</div>
      <div class="cards">${cards}</div>
      <div class="box"><h3>${escapeHtml(T('ui.steuerungTitel', null, 'Steuerung'))}</h3>${TL('ui.steuerung', ['Pfeiltasten/WASD: gehen', 'Leertaste: Aktion', 'E: Spezial', 'Esc: Pause']).map(escapeHtml).join('<br>')}</div>
      <div class="box"><h3>${escapeHtml(T('ui.highscoreTitel', null, 'Highscores'))}</h3>${this.highscoreHTML()}</div>
      <div class="box" style="text-align:center"><button class="bigbtn alt musicToggle" id="tMusic">${escapeHtml(Music.label())}</button> <button class="bigbtn alt" id="tMute">${Sfx.muted ? '♪ Ton: aus' : '♪ Ton: an'}</button></div>
    </div>`;
    let sel = 0;
    const mark = () => document.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('sel', i === sel));
    this.showOverlay(html, 'title', (ev) => {
      if (ev === 'left' || ev === 'up') { sel = (sel + FIGUREN.length - 1) % FIGUREN.length; mark(); }
      if (ev === 'right' || ev === 'down') { sel = (sel + 1) % FIGUREN.length; mark(); }
      if (ev === 'action' || ev === 'confirm') { Music.resumeIfWanted(); Sfx.play('good'); startGame(FIGUREN[sel]); }
    });
    mark();
    document.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => { Sfx.unlock(); Music.resumeIfWanted(); Sfx.play('good'); startGame(c.dataset.id); }));
    const mu = $('tMusic');
    if (mu) mu.addEventListener('click', () => { Sfx.unlock(); Music.toggle(); });
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

  // ---- Minispiel: Radl-Notdienst (Schrauben lockern sich – schnell festziehen!) ----
  minigameScrews(cb) {
    const need = B('minispiele.schraubenZiel', 12), maxMiss = B('minispiele.schraubenFehler', 3);
    let time = B('minispiele.schraubenSekunden', 25);
    let windowMs = B('minispiele.schraubenFensterStartMs', 1400);
    const minWin = B('minispiele.schraubenFensterMinMs', 600);
    const html = `<div class="mg"><h2>${escapeHtml(T('minispiele.schrauben.titel', null, 'Radl-Notdienst!'))}</h2>
      <div>${escapeHtml(T('minispiele.schrauben.hilfe', null, 'Schrauben lockern sich! Antippen (oder Taste 1–6), bevor sie rausfallen.'))}</div>
      <div class="mgstat"><span id="mgOk">0/${need}</span><span class="mgtimer" id="mgT">${time}</span><span id="mgMiss">${'♥'.repeat(maxMiss)}</span></div>
      <div class="wheelwrap"><div class="wheel" id="mgW"><div class="hub"></div></div></div></div>`;
    let ok = 0, miss = 0, done = false;
    const bolts = [];
    const finish = (win) => {
      if (done) return; done = true;
      clearInterval(iv); clearTimeout(spawnT);
      if (this.overlayMode !== 'minigame' || (G && G.ended)) return;
      this.hideOverlay(); Sfx.play(win ? 'good' : 'bad'); cb(win);
    };
    const tighten = (i) => {
      const b = bolts[i];
      if (done || !b || !b.loose) { if (!done) { Sfx.play('blip'); } return; }
      b.loose = false; clearTimeout(b.t);
      b.el.className = 'bolt tight';
      ok++; $('mgOk').textContent = ok + '/' + need;
      Sfx.play('type');
      windowMs = Math.max(minWin, windowMs - 60);
      if (ok >= need) finish(true);
    };
    this.showOverlay(html, 'minigame', (ev, arg) => { if (ev === 'num' && arg >= 1 && arg <= 6) tighten(arg - 1); }, true);
    const wheel = $('mgW');
    for (let i = 0; i < 6; i++) {
      const el = document.createElement('div');
      el.className = 'bolt tight';
      const a = i / 6 * Math.PI * 2 - Math.PI / 2;
      el.style.left = (50 + Math.cos(a) * 36) + '%'; el.style.top = (50 + Math.sin(a) * 36) + '%';
      el.textContent = i + 1;
      const h = (e) => { e.preventDefault(); e.stopPropagation(); tighten(i); };
      el.addEventListener('mousedown', h); el.addEventListener('touchstart', h, { passive: false });
      wheel.appendChild(el);
      bolts.push({ el, loose: false, t: null });
    }
    let spawnT = null;
    const spawn = () => {
      if (done) return;
      const free = bolts.map((b, i) => i).filter(i => !bolts[i].loose);
      if (free.length) {
        const i = pick(free), b = bolts[i];
        b.loose = true; b.el.className = 'bolt loose';
        b.el.style.animationDuration = windowMs + 'ms';
        b.t = setTimeout(() => {
          if (done || !b.loose) return;
          b.loose = false; b.el.className = 'bolt lost';
          miss++; $('mgMiss').textContent = '♥'.repeat(Math.max(0, maxMiss - miss));
          Sfx.play('bad');
          setTimeout(() => { if (!done) b.el.className = 'bolt tight'; }, 500);
          if (miss >= maxMiss) finish(false);
        }, windowMs);
      }
      spawnT = setTimeout(spawn, Math.max(350, windowMs * 0.55));
    };
    spawnT = setTimeout(spawn, 600);
    const iv = setInterval(() => {
      if (G && G.paused) return;
      time -= 0.1;
      const t = $('mgT'); if (t) t.textContent = Math.max(0, Math.ceil(time)) + ' s';
      if (time <= 0) finish(false);
    }, 100);
  },

  // ---- Minispiel: willhaben-Feilschen (im richtigen Moment zuschlagen) ----
  // cb(endpreis)
  minigameHaggle(opts, cb) {
    const rounds = B('minispiele.feilschRunden', 3);
    let price = opts.price, round = 0, pos = 0, dir = 1, done = false, locked = false;
    let zone = B('minispiele.feilschZoneStart', 30); // Breite der grünen Zone in %
    let zoneX = rnd(10, 90 - zone);
    let speed = B('minispiele.feilschTempo', 90);    // % pro Sekunde
    const html = `<div class="mg"><h2>${escapeHtml(T('minispiele.feilschen.titel', { item: opts.item }, 'Feilschen: {item}'))}</h2>
      <div>${escapeHtml(opts.line || '')}</div>
      <div class="bigprice" id="hgP">${euro(price)}</div>
      <div class="haggle"><div class="hzone" id="hgZ"></div><div class="hneedle" id="hgN"></div></div>
      <div id="hgMsg">${escapeHtml(T('minispiele.feilschen.hilfe', null, 'Drück A / Leertaste, wenn die Nadel im grünen Bereich ist!'))}</div>
      <div class="mgstat"><span id="hgR">${T('minispiele.feilschen.runde', { n: 1, max: rounds }, 'Runde {n}/{max}')}</span></div>
      <button class="bigbtn" id="hgB">${escapeHtml(T('minispiele.feilschen.bieten', null, 'BIETEN!'))}</button></div>`;
    const setZone = () => { const z = $('hgZ'); if (z) { z.style.left = zoneX + '%'; z.style.width = zone + '%'; } };
    const finish = () => {
      if (done) return; done = true; clearInterval(iv);
      if (this.overlayMode !== 'minigame' || (G && G.ended)) return;
      setTimeout(() => { if (this.overlayMode === 'minigame') this.hideOverlay(); cb(price); }, 900);
    };
    const bid = () => {
      if (done || locked) return;
      locked = true;
      const center = zoneX + zone / 2;
      let msg, cut;
      if (pos >= zoneX && pos <= zoneX + zone) {
        const perfect = Math.abs(pos - center) < zone * 0.18;
        cut = perfect ? B('minispiele.feilschPerfekt', 0.35) : B('minispiele.feilschGut', 0.2);
        msg = perfect ? T('minispiele.feilschen.perfekt', null, 'PERFEKT! „Na guat, weil du’s bist.“') : T('minispiele.feilschen.gut', null, 'Gut! „Passt, a bissl runter.“');
        Sfx.play(perfect ? 'good' : 'coin');
      } else { cut = 0; msg = T('minispiele.feilschen.daneben', null, 'Daneben! „Na, sicher ned.“'); Sfx.play('bad'); }
      price = Math.max(opts.min, Math.round(price * (1 - cut) * 2) / 2);
      $('hgP').textContent = euro(price); $('hgMsg').textContent = msg;
      round++;
      if (round >= rounds) { $('hgMsg').textContent = msg + ' ' + T('minispiele.feilschen.deal', { preis: euro(price) }, 'Deal: {preis}'); finish(); return; }
      setTimeout(() => {
        if (done) return;
        locked = false;
        zone = Math.max(10, zone - 7); zoneX = rnd(5, 95 - zone); speed *= 1.25; setZone();
        $('hgR').textContent = T('minispiele.feilschen.runde', { n: round + 1, max: rounds }, 'Runde {n}/{max}');
      }, 700);
    };
    this.showOverlay(html, 'minigame', (ev) => { if (ev === 'action' || ev === 'confirm') bid(); }, true);
    setZone();
    const btn = $('hgB');
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); bid(); });
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); bid(); }, { passive: false });
    const iv = setInterval(() => {
      if ((G && G.paused) || locked) return;
      pos += dir * speed * 0.016;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      const n = $('hgN'); if (n) n.style.left = pos + '%';
    }, 16);
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
