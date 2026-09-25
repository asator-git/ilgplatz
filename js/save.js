// ---------------------------------------------------------------
// save.js – Zwischenstand speichern / laden (localStorage)
// Ein Speicherplatz. Automatisch alle paar Sekunden + beim Pausieren.
// ---------------------------------------------------------------
'use strict';

const SaveGame = {
  KEY: 'ilgplatz_spielstand_v1',

  load() {
    try {
      const raw = window.localStorage.getItem(this.KEY);
      const s = raw ? JSON.parse(raw) : null;
      return s && s.v === 1 && s.figur ? s : null;
    } catch (e) { return null; }
  },

  clear() { try { window.localStorage.removeItem(this.KEY); } catch (e) { /* egal */ } },

  // Kurzbeschreibung für den Startbildschirm
  describe(s) {
    return T('speichern.weiterBeschreibung', {
      figur: T('figuren.' + s.figur + '.name', null, s.figur), zeit: clockStr(s.minute), n: Math.round(s.rep)
    }, '{figur} · {zeit} · Ansehen {n}');
  },

  // Nur Dinge speichern, die man nach dem Neuladen wieder herstellen kann
  save(scene, manual) {
    if (!G || G.ended || !scene || !scene.player) return false;
    const p = scene.player;
    const flags = {};
    for (const k in G.flags) {
      const v = G.flags[k];
      if (['berndWut', 'marcoWild', 'exSchonfrist'].includes(k)) continue;      // laufende Echtzeit-Aktionen
      if (v === null || ['number', 'boolean', 'string'].includes(typeof v)) flags[k] = v;
    }
    const q = {};
    for (const id in G.q) {
      const st = G.q[id];
      q[id] = { status: st.status, step: st.step, readyAt: st.readyAt, startMin: st.startMin, data: JSON.parse(JSON.stringify(st.data || {})) };
    }
    const data = {
      v: 1, savedAt: Date.now(), lang: Lang.cur,
      figur: G.figur, minute: G.minute, rep: G.rep, money: G.money, inv: G.inv,
      rivalAdj: G.rivalAdj, hunger: G.hunger, talkHour: G.talkHour, questsDone: G.questsDone,
      priceMods: G.priceMods, freeCoffee: G.freeCoffee, marcoHired: !!G.marcoHired,
      companion: G.companion ? { until: G.companion.until } : null,
      flags, q,
      player: { x: p.x, y: p.y, state: ['wet', 'grantig', 'liebeskummer'].includes(p.state) ? p.state : 'normal' },
      abil: { lastLoss: Abilities.lastLoss, hacked: Abilities.hacked },
      bernd: scene.actors.bernd ? { anger: scene.actors.bernd.data.anger || 0, nextRage: scene.actors.bernd.data.nextRage || 0 } : null
    };
    try {
      window.localStorage.setItem(this.KEY, JSON.stringify(data));
      if (manual) UI.toast(T('speichern.gespeichert', null, 'Spielstand gespeichert!'), 'good');
      return true;
    } catch (e) {
      if (manual) UI.toast(T('speichern.fehler', null, 'Speichern ging leider nicht.'), 'bad');
      return false;
    }
  },

  // Nach dem Aufbau der Welt den Spielstand darüberlegen
  apply(scene, s) {
    const p = scene.player;
    Object.assign(G, {
      minute: s.minute, rep: s.rep, money: s.money, inv: s.inv || {}, rivalAdj: s.rivalAdj || 0,
      hunger: G.figur === 'andi' ? (s.hunger !== null && s.hunger !== undefined ? s.hunger : 100) : null,
      talkHour: s.talkHour || {}, questsDone: s.questsDone || 0,
      priceMods: s.priceMods || { hackUntil: 0 }, freeCoffee: s.freeCoffee || 0,
      marcoHired: !!s.marcoHired
    });
    Object.assign(G.flags, s.flags || {});
    // Aufträge
    for (const id in s.q || {}) {
      if (!G.q[id]) continue;
      Object.assign(G.q[id], s.q[id]);
      const st = G.q[id];
      if (st.status !== 'active') continue;
      // Echtzeit-/Einsatz-Aufträge lassen sich nicht fortsetzen
      if (['bernd', 'marcoWild'].includes(id)) { st.status = 'done'; continue; }
      if (id === 'lieferung') { st.status = 'available'; st.data = {}; while (scene.takeItem('lieferung')) { /* kalt */ } continue; }
      if (id === 'americano' || (id === 'andi' && G.figur !== 'andi')) QDEF[id].onStart(scene, st);
      if (id === 'erwin') { st.step = null; QDEF.erwin.onStart(scene, st); }
      if (id === 'ulli') {
        for (const it of QDEF.ulli.items()) {
          const v = scene.actors[it.seller];
          if (st.data.got && st.data.got[it.key]) continue;
          v.setPresent(true); v.setTile(it.spot.x, it.spot.y); v.homeX = v.x; v.homeY = v.y;
        }
      }
    }
    // Abgeschlossene/aufgedeckte Dinge wiederherstellen
    if (G.flags.radGeholt === false || G.flags.radGeholt === undefined) G.flags.radGeholt = false;
    const lena = scene.actors.lena;
    if (lena && G.q.barista && (G.q.barista.status === 'done' || (G.q.barista.data && G.q.barista.data.coffee))) { lena.data.crying = false; lena.sprite.setTexture('ch_lena_ok'); }
    if (G.marcoHired) { const m = scene.actors.marco; m.follow = p; }
    if (G.flags.marcoWegBis && G.minute < G.flags.marcoWegBis) scene.actors.marco.setPresent(false);
    if (s.companion && s.companion.until > G.minute && G.figur !== 'hubi') { Abilities.startCompanion(scene, false); G.companion.until = s.companion.until; }
    if (s.abil) { Abilities.lastLoss = s.abil.lastLoss || G.minute; Abilities.hacked = s.abil.hacked || {}; }
    if (s.bernd && scene.actors.bernd) Object.assign(scene.actors.bernd.data, s.bernd);
    // Jewi in der Therapie?
    const j = scene.actors.jewi;
    if (j && j !== p && ['geht', 'weg'].includes(G.flags.jewiPhase)) { G.flags.jewiPhase = 'weg'; j.setPresent(false); }
    // Laufende Zeitfenster der Tages-Events wieder herstellen
    Events.restoreWindows(scene);
    // Spieler
    p.setPos(s.player.x, s.player.y);
    if (scene.playerBlocked(p.x, p.y)) scene.teleportPlayer(p.tx, p.ty);
    if (s.player.state !== 'normal') p.setState(s.player.state, s.player.state === 'wet' ? 5 : 0);
    scene.cameras.main.centerOn(p.x, p.y);
    const hours = (G.minute - G.startMinute) / 60;
    G.rivalRep = Math.max(0, B('rivale.start', 150) + B('rivale.proStunde', 10) * hours + G.rivalAdj);
    UI.toast(T('speichern.geladen', { zeit: clockStr(G.minute) }, 'Weiter geht\'s um {zeit}!'), 'good');
  }
};
