// ---------------------------------------------------------------
// quests.js – alle Aufträge (Anzeige, Ziele, Gesprächsoptionen)
// ---------------------------------------------------------------
'use strict';

const QUEST_ORDER = ['start', 'americano', 'andi', 'rad', 'schrauben', 'paket', 'nase', 'barista', 'baden', 'demo', 'steckdose', 'gruesse', 'foto', 'erwin', 'lieferung'];

// Kurzformen
const QT = (id, k, v, fb) => T('quests.' + id + '.' + k, v, fb);
const QL = (id, k, fb) => TL('quests.' + id + '.' + k, fb ? [fb] : undefined);

const Quests = {
  init(scene) {
    this.scene = scene;
    G.q = {};
    for (const id of QUEST_ORDER) G.q[id] = { status: 'locked', step: null, data: {}, readyAt: 0 };
    G.q.start.status = 'active';
    this.arrow = scene.add.image(0, 0, 'arrow').setDepth(25000).setVisible(false).setAlpha(0.9);
    const b = LOC.bikeSpot;
    this.bike = scene.add.image(b.x * TILE + 8, b.y * TILE + 14, 'bike').setOrigin(0.5, 1).setDepth(b.y * TILE + 14);
    this.nose = scene.add.image(0, 0, 'nose').setDepth(30000).setVisible(false);
    this.sign = scene.add.image(0, 0, 'banner_sign').setOrigin(0.5, 1).setVisible(false);
    const sch = scene.actors.schlosser;
    this.crate = scene.add.image(sch.x + 12, sch.y, 'crate').setOrigin(0.5, 1).setDepth(sch.y).setVisible(false);
    this.markT = 0;
  },

  // ---- Grundfunktionen ----
  act(id) { return this.scene.actors[id]; },
  st(id) { return G.q[id]; },
  isActive(id) { return G.q[id] && G.q[id].status === 'active'; },
  has(k) { return this.scene.hasItem(k); },

  giverOf(id) {
    const f = G.figur;
    switch (id) {
      case 'rad': return f === 'carla' ? null : 'carla';
      case 'baden': return f === 'hubi' ? null : 'hubi';
      case 'demo': return f === 'andi' ? 'hubi' : 'andi';
      case 'steckdose': return f === 'markus' ? null : 'markus';
      case 'gruesse': return f === 'juliette' ? null : 'juliette';
      case 'foto': return f === 'jewi' ? null : 'jewi';
      case 'schrauben': return 'didi';
      case 'paket': return 'schlosser';
      case 'nase': return 'michi';
      case 'barista': return 'lena';
      case 'erwin': return 'daniel';
      case 'lieferung': return 'koch';
      default: return null;
    }
  },

  availableFrom(id) {
    const m = { rad: '08:30', schrauben: '08:00', paket: '08:00', nase: '09:00', barista: '08:00', baden: '09:30', demo: B('auftraege.demoAb', '13:00'), steckdose: '09:00', gruesse: '08:30', foto: '09:00', erwin: B('auftraege.erwinAb', '12:00'), lieferung: B('auftraege.lieferungAb', '11:30') };
    return parseClock(m[id], 99999);
  },

  isMust(id) { return id === 'americano' || id === 'andi'; },
  isInstant(id) { return id === 'schrauben'; },

  openCount() {
    return QUEST_ORDER.filter(id => this.isActive(id) && !this.isMust(id) && this.giverOf(id) && id !== 'start').length;
  },

  start(id) {
    const st = G.q[id];
    st.status = 'active'; st.step = null; st.data = {}; st.startMin = G.minute;
    const d = QDEF[id];
    if (d && d.onStart) d.onStart(this.scene, st);
    if (!this.isInstant(id)) {
      UI.toast(T('quests.neu', { titel: QT(id, 'titel', null, id) }, 'Neuer Auftrag: {titel}'), '');
      Sfx.play('announce');
    }
  },

  complete(id, rep, money, msg) {
    const st = G.q[id];
    const d = QDEF[id];
    if (rep) this.scene.addRep(rep, QT(id, 'titel', null, id), { quest: true });
    if (money) this.scene.addMoney(money, QT(id, 'titel', null, id));
    G.questsDone++;
    if (d && d.repeat) { st.status = 'cooldown'; st.readyAt = G.minute + (d.cooldown ? d.cooldown() : 20); }
    else st.status = 'done';
    st.data = {};
    UI.banner(msg || T('quests.erledigt', { titel: QT(id, 'titel', null, id) }, 'Auftrag erledigt: {titel}'), 3200, 'info');
    Sfx.play('good');
  },

  fail(id, msg, cooldown) {
    const st = G.q[id];
    const d = QDEF[id];
    if (d && d.onEnd) d.onEnd(this.scene, st);
    if (cooldown !== undefined) { st.status = 'cooldown'; st.readyAt = G.minute + cooldown; }
    else st.status = 'failed';
    st.data = {};
    if (msg) UI.banner(msg, 3500);
    Sfx.play('bad');
  },

  // ---- Hooks aus anderen Modulen ----
  onInteract(a) {
    if (this.isActive('start') && a.id === 'daniel') {
      const key = G.figur === 'juliette' ? 'danielJuliette' : (G.figur === 'jewi' ? 'danielJewi' : 'daniel');
      UI.dialog(QL('start', key, 'Guten Morgen.').map(t => ({ who: a.name, text: fmt(t) })), {
        onClose: () => this.complete('start', B('auftraege.startDaniel', 5), 0, QT('start', 'fertig', null, 'Der Tag kann beginnen!'))
      });
      return true;
    }
    return false;
  },

  onItemLost(scene, k, byPolice) {
    for (const id of QUEST_ORDER) {
      const d = QDEF[id];
      if (this.isActive(id) && d && d.onLost) d.onLost(scene, G.q[id], k, byPolice);
    }
  },
  onAndiFed(scene) { const d = QDEF.andi; if (this.isActive('andi') && G.figur === 'andi') d.fed(scene, G.q.andi); },
  onAndiCalmed() { /* Mascha beruhigt – Hunger bleibt */ },
  onTalkedDown() { /* Zustand wird beim Schlosser direkt geprüft */ },
  onMarcoPush() { /* Tesla-Foto zählt trotzdem */ },
  onSchlosserPhoto(scene, sch) {
    if (G.flags.schlosserPackt) {
      if (!G.flags.beweisfotoBonus) {
        G.flags.beweisfotoBonus = true;
        scene.addRep(B('figuren.jewi.beweisfotoAnsehen', 40), T('quests.beweisfoto', null, 'Beweisfoto!'));
      }
      if (!scene.hasItem('beweisfoto')) scene.giveItem('beweisfoto');
      UI.toast(T('quests.beweisfotoText', null, 'Erwischt – mit Paket in der Hand!'), 'good');
    } else UI.toast(T('quests.keinBeweis', null, 'Kein Beweis drauf – er hat grad nix in der Hand. Warte, bis er packt.'), '');
  },

  // Optionen im Gespräch
  optionsFor(scene, a) {
    const o = [];
    for (const id of QUEST_ORDER) {
      const st = G.q[id], d = QDEF[id];
      if (!d) continue;
      if (st.status === 'available' && this.giverOf(id) === a.id) {
        if (this.isInstant(id)) { o.push(...d.offerOptions(scene, st, a)); continue; }
        o.push({ label: T('quests.angebotLabel', { titel: QT(id, 'titel', null, id) }, 'Auftrag: {titel}'), fn: () => this.offer(id, a) });
      } else if (st.status === 'active' && d.options) {
        o.push(...(d.options(scene, st, a) || []));
      }
    }
    return o;
  },

  offer(id, a) {
    const pages = QL(id, 'angebot', '…').map(t => ({ who: a.name, text: fmt(t) }));
    const full = this.openCount() >= B('auftraege.maxOffen', 3);
    UI.dialog(pages, {
      options: [
        { label: T('quests.annehmen', null, 'Passt, mach i!'), disabled: full, why: T('quests.zuViele', null, 'Du hast schon 3 Aufträge offen. Erledig zuerst was!'), fn: () => this.start(id) },
        { label: T('quests.spaeter', null, 'Später vielleicht.'), fn: () => {} }
      ]
    });
  },

  interactables(scene) {
    const list = [];
    for (const id of QUEST_ORDER) {
      const st = G.q[id], d = QDEF[id];
      if (d && d.inter && st.status === 'active') list.push(...(d.inter(scene, st) || []));
    }
    // Quelle: immer
    list.push(...QDEF_ALWAYS.inter(scene));
    if (typeof Events !== 'undefined' && Events.interactables) list.push(...(Events.interactables(scene) || []));
    return list;
  },

  promptFor(a) { return null; },

  // HUD-Liste
  hudList(scene) {
    const out = [];
    const ids = QUEST_ORDER.filter(id => this.isActive(id));
    ids.sort((x, y) => (this.isMust(y) ? 1 : 0) - (this.isMust(x) ? 1 : 0));
    for (const id of ids) {
      const d = QDEF[id];
      const st = G.q[id];
      const h = d && d.hud ? d.hud(scene, st) : { text: '' };
      out.push({ title: QT(id, 'titel', null, id), text: fmt(h.text || ''), must: this.isMust(id), timer: h.timer || '' });
    }
    // Angebote als Hinweis ergänzen
    if (out.length < 3) {
      for (const id of QUEST_ORDER) {
        if (out.length >= 3) break;
        const st = G.q[id];
        const g = this.giverOf(id);
        if (st.status === 'available' && g && this.act(g) && this.act(g).present) {
          out.push({ title: T('quests.angebotHud', null, 'Angebot'), text: T('quests.angebotHudText', { name: this.act(g).name, titel: QT(id, 'titel', null, id) }, '{name}: {titel} (!)'), must: false });
        }
      }
    }
    return out;
  },

  // Zielpunkt des wichtigsten Auftrags
  currentTarget(scene) {
    const ids = QUEST_ORDER.filter(id => this.isActive(id));
    ids.sort((x, y) => (this.isMust(y) ? 1 : 0) - (this.isMust(x) ? 1 : 0));
    for (const id of ids) {
      const d = QDEF[id];
      if (d && d.target) {
        const t = d.target(scene, G.q[id]);
        if (t) return t;
      }
    }
    return null;
  },

  update(scene, dt) {
    const m = G.minute;
    // Freischalten / Cooldowns
    for (const id of QUEST_ORDER) {
      const st = G.q[id];
      if (this.isMust(id) || id === 'start') continue;
      if ((st.status === 'locked' && m >= this.availableFrom(id)) || (st.status === 'cooldown' && m >= st.readyAt)) {
        if (!this.giverOf(id)) { if (st.status === 'locked') this.start(id); }
        else st.status = 'available';
      }
    }
    for (const id of QUEST_ORDER) {
      const d = QDEF[id];
      if (this.isActive(id) && d && d.update) d.update(scene, G.q[id], dt);
    }
    if (typeof Shops !== 'undefined') Shops.update(scene);
    // Schlosser „packt“ jede zweite halbe Stunde
    G.flags.schlosserPackt = Math.floor(m / 30) % 2 === 0;
    const sch = scene.actors.schlosser;
    this.crate.setVisible(G.flags.schlosserPackt).setPosition(sch.x + 11, sch.y).setDepth(sch.y + 1);
    // Clownnase / Transparent am Spieler
    const p = scene.player;
    this.nose.setVisible(this.has('nase') && p.sprite.visible).setPosition(Math.round(p.x) + (p.facing < 0 ? -0 : 0), Math.round(p.y) - 16);
    const showSign = this.has('transparent');
    this.sign.setVisible(showSign && p.sprite.visible).setPosition(Math.round(p.x) + 6, Math.round(p.y) - 14).setDepth(p.y + 1);
    this.bike.setVisible(!G.flags.radGeholt);

    // Marker & Pfeil
    this.markT -= dt;
    if (this.markT <= 0) { this.markT = 250; this.updateMarkers(scene); }
    this.updateArrow(scene);
  },

  updateMarkers(scene) {
    for (const a of scene.npcs) a.questIcon = null;
    for (const id of QUEST_ORDER) {
      const st = G.q[id];
      const g = this.giverOf(id);
      if (st.status === 'available' && g && this.act(g) && this.act(g) !== scene.player) this.act(g).questIcon = 'ic_excl';
    }
    const t = this.currentTarget(scene);
    if (t && t.actor && t.actor !== scene.player) t.actor.questIcon = 'ic_quest';
  },

  updateArrow(scene) {
    const p = scene.player;
    const t = this.currentTarget(scene);
    if (!t || !p.sprite.visible || G.ended) { this.arrow.setVisible(false); return; }
    const tx = t.actor ? t.actor.x : t.x, ty = t.actor ? t.actor.y - 8 : t.y;
    const dx = tx - p.x, dy = ty - (p.y - 10);
    const d = Math.hypot(dx, dy);
    if (d < 36) { this.arrow.setVisible(false); return; }
    const ang = Math.atan2(dy, dx);
    const r = 20 + Math.sin(G.realMs / 180) * 2;
    this.arrow.setVisible(true).setRotation(ang).setPosition(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y - 10 + Math.sin(ang) * r));
  }
};

// ---- Hilfsfunktionen für Ziele ----
function tgtActor(id) { const a = Quests.act(id); return a && a.present ? { actor: a } : null; }
function tgtTile(t) { return { x: t.x * TILE + 8, y: t.y * TILE + 8 }; }
const FOUNTAIN_PX = () => ({ x: (LOC.fountain.x + 1) * TILE, y: (LOC.fountain.y + 1) * TILE + 6 });
function nearestPlum(scene) {
  const p = scene.player;
  let best = null, bd = 1e9;
  for (const t of scene.objs.trees) if (t.kind === 'plum') { const d = dist(p.x, p.y, t.x, t.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
function timerText(untilMin) { return Math.max(0, Math.ceil(untilMin - G.minute)) + ' Min'; }
function benchPx(i) { const b = LOC.benches[i]; return { x: (b.x + 1.5) * TILE, y: (b.y + 1) * TILE + 4 }; }

// ---- Auftragsdefinitionen ----
const QDEF = {
  start: {
    hud: () => ({ text: QT('start', 'hud', null, 'Geh ins Café und red mit Daniel.') }),
    target: () => tgtActor('daniel')
  },

  // 1) Americano für Hubi
  americano: {
    deadline() { return parseClock(B('auftraege.americanoDeadline', '11:05'), 665); },
    onStart(scene) {
      const dl = this.deadline();
      const m = scene.actors.mascha;
      if (G.figur === 'hubi') {
        m.follow = null; m.path = null;
        m.override = { tx: LOC.hubiWait.x, ty: LOC.hubiWait.y, until: dl + 1 };
      } else {
        const h = scene.actors.hubi;
        if (!G.companion) { h.override = { tx: LOC.hubiWait.x, ty: LOC.hubiWait.y, until: dl + 1 }; h.path = null; }
      }
      const e = scene.actors.erwin;
      e.override = { tx: LOC.cafeFront.x, ty: LOC.cafeFront.y + 1, until: dl + 5 }; e.path = null;
    },
    who(scene) { return G.figur === 'hubi' ? scene.actors.mascha : scene.actors.hubi; },
    hud(scene) {
      const has = scene.hasItem('americano');
      const k = has ? (G.figur === 'hubi' ? 'hudZuMascha' : 'hudZuHubi') : 'hudKaufen';
      return { text: QT('americano', k), timer: timerText(this.deadline()) };
    },
    target(scene) { return scene.hasItem('americano') ? { actor: this.who(scene) } : tgtActor('daniel'); },
    update(scene, st) {
      const p = scene.player;
      const w = this.who(scene);
      if (scene.hasItem('americano') && w && w.present && dist(p.x, p.y, w.x, w.y) < 24 && !UI.isBlocking()) {
        scene.takeItem('americano');
        this.onEnd(scene);
        Quests.complete('americano', B('auftraege.americano', 60), 0, QT('americano', 'erfolg', null, 'Rechtzeitig! Hubi geht mit Mascha Gassi.'));
        UI.dialog(QL('americano', G.figur === 'hubi' ? 'erfolgHubi' : 'erfolgDialog').map(t => ({ who: G.figur === 'hubi' ? scene.player.name : scene.actors.hubi.name, text: fmt(t) })));
        if (typeof Events !== 'undefined') Events.hubiGassi(scene);
        return;
      }
      if (G.minute >= this.deadline()) {
        this.onEnd(scene);
        Quests.fail('americano', QT('americano', 'zuSpaet', null, 'ZU SPÄT! Hubi hat keinen Kaffee…'));
        if (typeof Events !== 'undefined') Events.earthquake(scene);
      }
    },
    onEnd(scene) {
      const m = scene.actors.mascha;
      m.override = null;
      m.follow = scene.actors.hubi;
      if (scene.actors.hubi !== scene.player) scene.actors.hubi.override = null;
    }
  },

  // 2) Andi füttern
  andi: {
    deadline(st) { return st.startMin + B('auftraege.andiFristMin', 20); },
    onStart(scene, st) {
      if (G.figur === 'andi') { G.hunger = Math.min(G.hunger, 10); return; }
      const a = scene.actors.andi;
      const seat = LOC.cafeSeats[0];
      a.override = { tx: seat.x, ty: seat.y, until: st.startMin + 120 };
      a.path = null;
      a.data.hungry = true;
    },
    hud(scene, st) {
      if (G.figur === 'andi') return { text: QT('andi', 'hudSelbst'), timer: timerText(this.deadline(st)) };
      const food = scene.hasItem('essen') || scene.hasItem('kipferl');
      if (st.data.late) return { text: QT('andi', food ? 'hudSpaetBringen' : 'hudSpaet') };
      return { text: QT('andi', food ? 'hudBringen' : 'hudHolen'), timer: timerText(this.deadline(st)) };
    },
    target(scene) {
      const food = scene.hasItem('essen') || scene.hasItem('kipferl');
      if (G.figur === 'andi') return food ? null : tgtActor('koch');
      return food ? tgtActor('andi') : tgtActor('koch');
    },
    options(scene, st, a) {
      if (a.id !== 'andi' || G.figur === 'andi') return [];
      const food = scene.hasItem('essen') ? 'essen' : (scene.hasItem('kipferl') ? 'kipferl' : null);
      if (!food) return [];
      return [{ label: QT('andi', 'geben', null, 'Da, iss was!'), fn: () => {
        scene.takeItem(food);
        a.clearState(); a.data.hungry = false; a.override = null;
        Sfx.play('eat');
        UI.dialog(QL('andi', 'danke').map(t => ({ who: a.name, text: fmt(t) })));
        Quests.complete('andi', st.data.late ? Math.round(B('auftraege.andiBelohnung', 30) / 2) : B('auftraege.andiBelohnung', 30));
      } }];
    },
    fed(scene, st) {
      if (G.minute <= this.deadline(st)) Quests.complete('andi', B('auftraege.andiBelohnung', 30));
      else Quests.complete('andi', 0);
    },
    update(scene, st) {
      if (G.minute < this.deadline(st) || st.data.late) return;
      if (G.figur === 'andi') { Quests.fail('andi', QT('andi', 'selbstVerpasst', null, 'Zu spät gegessen. Andi ist grantig.')); return; }
      st.data.late = true;
      const a = scene.actors.andi;
      a.setState('grantig');
      scene.addRep(-B('auftraege.andiVerpasstVerlust', 20), QT('andi', 'verpasstKurz', null, 'Andi verhungert'));
      UI.banner(QT('andi', 'verpasst', null, 'Andi ist GRANTIG! Gespräche in seiner Nähe scheitern.'), 3500);
    }
  },

  // 3) Carlas Rad
  rad: {
    steps() { return G.figur === 'carla' ? ['michi', 'quelle', 'didi', 'schlosser', 'stern', 'zurueck'] : ['didi', 'schlosser', 'stern', 'zurueck']; },
    onStart(scene, st) { st.step = this.steps()[0]; G.flags.radGeholt = false; },
    next(st) { const s = this.steps(); st.step = s[Math.min(s.length - 1, s.indexOf(st.step) + 1)]; },
    hud(scene, st) {
      if (st.step === 'schlosser' && st.data.denied && !scene.hasItem('beweisfoto')) {
        const k = G.figur === 'carla' ? 'hudBeweisCarla' : (G.figur === 'jewi' ? 'hudBeweisJewi' : 'hudBeweis');
        return { text: QT('rad', k) };
      }
      return { text: QT('rad', 'hud_' + st.step + (G.figur === 'carla' && st.step === 'zurueck' ? 'Carla' : '')) };
    },
    target(scene, st) {
      switch (st.step) {
        case 'michi': return tgtActor('michi');
        case 'quelle': return FOUNTAIN_PX();
        case 'didi': return tgtActor('didi');
        case 'schlosser':
          if (st.data.denied && !scene.hasItem('beweisfoto') && G.figur !== 'carla' && G.figur !== 'jewi') return tgtActor('jewi');
          return tgtActor('schlosser');
        case 'stern': return tgtTile(LOC.bikeSpot);
        case 'zurueck': return tgtActor(G.figur === 'carla' ? 'didi' : 'carla');
      }
      return null;
    },
    options(scene, st, a) {
      const o = [];
      const say = (key, then) => () => UI.dialog(QL('rad', key).map(t => ({ who: a.name, text: fmt(t) })), { onClose: then });
      if (st.step === 'michi' && a.id === 'michi') o.push({ label: QT('rad', 'frageMichi'), fn: say('michi', () => this.next(st)) });
      if (st.step === 'didi' && a.id === 'didi') o.push({ label: QT('rad', 'frageDidi'), fn: say('didi', () => this.next(st)) });
      if (st.step === 'schlosser' && a.id === 'schlosser') {
        o.push({ label: QT('rad', 'frageSchlosser'), fn: () => {
          if (scene.hasItem('beweisfoto') || a.state === 'talked') {
            const key = scene.hasItem('beweisfoto') ? 'gestaendnisFoto' : 'gestaendnisQuassel';
            scene.takeItem('beweisfoto');
            say(key, () => this.next(st))();
          } else { st.data.denied = true; say('leugnet')(); }
        } });
      }
      if (st.step === 'schlosser' && st.data.denied && a.id === 'jewi' && a !== scene.player && !scene.hasItem('beweisfoto')) {
        o.push({ label: QT('rad', 'frageJewi'), fn: say('jewiFoto', () => scene.giveItem('beweisfoto')) });
      }
      if (st.step === 'zurueck' && scene.hasItem('rad') && ((G.figur === 'carla' && a.id === 'didi') || a.id === 'carla')) {
        o.push({ label: QT('rad', 'zurueckgeben'), fn: say(G.figur === 'carla' ? 'ende_didi' : 'ende_carla', () => { scene.takeItem('rad'); Quests.complete('rad', B('auftraege.rad', 80)); }) });
      }
      return o;
    },
    inter(scene, st) {
      const l = [];
      if (st.step === 'quelle') { const f = FOUNTAIN_PX(); l.push({ x: f.x, y: f.y, r: 30, prio: -5, label: QT('rad', 'sucheQuelle'), fn: () => UI.dialog(QL('rad', 'quelle').map(t => ({ who: scene.player.name, text: fmt(t) })), { onClose: () => this.next(st) }) }); }
      if (st.step === 'stern' && !G.flags.radGeholt) {
        const b = LOC.bikeSpot;
        l.push({ x: b.x * TILE + 8, y: b.y * TILE + 8, r: 24, prio: -5, label: QT('rad', 'nehmen'), fn: () => { G.flags.radGeholt = true; scene.giveItem('rad'); this.next(st); UI.toast(QT('rad', 'genommen'), 'good'); } });
      }
      return l;
    },
    onLost(scene, st, k) {
      if (k === 'rad') { G.flags.radGeholt = false; st.step = 'stern'; UI.toast(QT('rad', 'verloren', null, 'Das Rad steht wieder am Stern…'), 'bad'); }
    }
  },

  // 4) Räder schrauben (sofort, wiederholbar)
  schrauben: {
    repeat: true,
    cooldown: () => B('auftraege.schraubenPauseMin', 20),
    offerOptions(scene, st, a) {
      return [{ label: QT('schrauben', 'label', null, 'Räder schrauben (Minispiel)'), fn: () => {
        UI.dialog([{ who: a.name, text: QT('schrauben', 'intro', null, 'Fünf Schrauben, der Reihe nach. Los!') }], {
          onClose: () => UI.minigameScrews((ok) => {
            if (ok) Quests.complete('schrauben', B('auftraege.schrauben', 15), B('auftraege.schraubenGeld', 10), QT('schrauben', 'erfolg', null, 'Sauber gschraubt!'));
            else UI.toast(QT('schrauben', 'fail', null, 'Schraube verloren. Nochmal?'), 'bad');
          })
        });
      } }];
    }
  },

  // 5) Pakete für den Schlosser
  paket: {
    repeat: true,
    cooldown: () => 10,
    onStart(scene) { scene.giveItem('paket'); },
    hud(scene) { return { text: QT('paket', G.minute >= parseClock(B('gegner.kiwaraAb', '19:00'), 1140) ? 'hudKiwara' : 'hud') }; },
    target: () => tgtActor('stern2'),
    options(scene, st, a) {
      if (a.id !== 'stern2' || !scene.hasItem('paket')) return [];
      return [{ label: QT('paket', 'abgeben', null, 'Paket vom Schlosser'), fn: () => {
        scene.takeItem('paket');
        UI.dialog(QL('paket', 'uebergabe').map(t => ({ who: a.name, text: fmt(t) })));
        Quests.complete('paket', B('auftraege.paket', 5), B('auftraege.paketGeld', 25));
      } }];
    },
    onLost(scene, st, k, byPolice) { if (k === 'paket') Quests.fail('paket', byPolice ? null : QT('paket', 'verloren', null, 'Paket weg!'), 5); }
  },

  // 6) Michis Clownnase
  nase: {
    onStart(scene, st) { scene.giveItem('nase'); st.data.laughed = []; },
    hud(scene, st) {
      if (!scene.hasItem('nase')) return { text: QT('nase', 'hudVerloren') };
      return { text: QT('nase', 'hud', { n: st.data.laughed.length, max: B('auftraege.naseLeute', 3) }) };
    },
    target(scene) { return scene.hasItem('nase') ? null : tgtActor('michi'); },
    options(scene, st, a) {
      const o = [];
      if (!scene.hasItem('nase')) {
        if (a.id === 'michi') o.push({ label: QT('nase', 'neueNase'), fn: () => { scene.giveItem('nase'); scene.say(a, QT('nase', 'neueNaseText', null, 'Eine Nase verliert man nie. Man verlegt sie.')); } });
        return o;
      }
      if (a.isDog || a === scene.player || st.data.laughed.includes(a.id) || a.state !== 'normal') return o;
      o.push({ label: QT('nase', 'aufsetzen', null, 'Clownnase aufsetzen: Lach amoi!'), fn: () => {
        if (a.id === 'marco') {
          scene.say(a, QT('nase', 'marco', null, 'Nein.'), 2000);
          scene.pushPlayer(a.x, a.y, 3);
          return;
        }
        a.setState('laughing', 0, 20000);
        Sfx.play('laugh');
        scene.say(a, QT('nase', 'lachen', null, 'HAHAHA!'), 2500);
        st.data.laughed.push(a.id);
        if (st.data.laughed.length >= B('auftraege.naseLeute', 3)) {
          scene.takeItem('nase');
          Quests.complete('nase', B('auftraege.nase', 35), 0, QT('nase', 'erfolg', null, 'Michi ist stolz auf dich!'));
        }
      } });
      return o;
    }
  },

  // 7) Die weinende Ex-Barista
  barista: {
    onStart(scene, st) { st.data.coffee = false; st.data.talk = false; },
    hud(scene, st) {
      const c = st.data.coffee ? '✓' : '✗', t = st.data.talk ? '✓' : '✗';
      return { text: QT('barista', 'hud', { c, t }) };
    },
    target(scene, st) { return !st.data.coffee ? (scene.hasItem('americano') ? tgtActor('lena') : tgtActor('daniel')) : tgtActor('daniel'); },
    check(st) { if (st.data.coffee && st.data.talk) Quests.complete('barista', 0, 0, QT('barista', 'fertig', null, 'Lena lächelt wieder!')); },
    options(scene, st, a) {
      const o = [];
      if (a.id === 'lena' && !st.data.coffee) {
        const has = scene.hasItem('americano');
        o.push({ label: QT('barista', 'kaffee'), disabled: !has, why: QT('barista', 'kaffeeFehlt'), fn: () => {
          scene.takeItem('americano');
          st.data.coffee = true; a.data.crying = false;
          a.sprite.setTexture('ch_lena_ok');
          UI.dialog(QL('barista', 'kaffeeDanke').map(t => ({ who: a.name, text: fmt(t) })));
          scene.addRep(B('auftraege.baristaKaffee', 30), QT('barista', 'kaffeeKurz', null, 'Kaffee für Lena'), { quest: true });
          this.check(st);
        } });
      }
      if (a.id === 'daniel' && !st.data.talk) {
        o.push({ label: QT('barista', 'zurRede'), fn: () => {
          UI.dialog([{ who: a.name, text: QT('barista', 'danielAusrede') }], { options: [
            { label: QT('barista', 'hoeflich'), fn: () => { st.data.talk = true; UI.dialog([{ who: a.name, text: QT('barista', 'hoeflichAntwort') }]); scene.addRep(B('auftraege.baristaHoeflich', 10), QT('barista', 'hoeflichKurz', null, 'höflich'), { quest: true, talk: true }); this.check(st); } },
            { label: QT('barista', 'derb'), fn: () => { st.data.talk = true; G.flags.derb = true; UI.dialog([{ who: a.name, text: QT('barista', 'derbAntwort') }]); scene.addRep(B('auftraege.baristaDerb', 40), QT('barista', 'derbKurz', null, 'derb'), { quest: true, talk: true }); UI.toast(QT('barista', 'derbPreise', null, 'Daniels Preise für dich: +30 %'), 'bad'); this.check(st); } }
          ] });
        } });
      }
      return o;
    }
  },

  // 8) Mascha baden
  baden: {
    onStart(scene) { if (G.figur !== 'hubi') Abilities.startCompanion(scene, false); },
    hud(scene) {
      const ok = Abilities.maschaWithPlayer(scene);
      return { text: QT('baden', ok ? 'hud' : 'hudHolen') };
    },
    target(scene) { return Abilities.maschaWithPlayer(scene) ? FOUNTAIN_PX() : (G.figur === 'hubi' ? { actor: scene.actors.mascha } : tgtActor('hubi')); },
    options(scene, st, a) {
      if (a.id === 'hubi' && G.figur !== 'hubi' && !G.companion) return [{ label: QT('baden', 'nochmal'), fn: () => Abilities.startCompanion(scene, false) }];
      return [];
    },
    inter(scene) {
      if (!Abilities.maschaWithPlayer(scene)) return [];
      const f = FOUNTAIN_PX();
      return [{ x: f.x, y: f.y, r: 32, prio: -8, label: QT('baden', 'label', null, 'Mascha baden'), fn: () => {
        const m = scene.actors.mascha;
        scene.tweens.add({ targets: m, x: f.x, y: f.y - 2, duration: 400, yoyo: true, hold: 1200 });
        Sfx.play('splash'); Sfx.play('bark');
        for (const a of scene.npcs) if (a.present && !a.isDog && dist(a.x, a.y, f.x, f.y) < 120 && a.state === 'normal') scene.say(a, QT('baden', 'suess', null, 'Ooooh, wie süß!'), 2500);
        Quests.complete('baden', B('auftraege.baden', 20), 0, QT('baden', 'erfolg', null, 'Mascha ist sauber. Alle finden\'s süß!'));
      } }];
    }
  },

  // 9) Demo-Vorbereitung
  demo: {
    onStart(scene, st) { st.data.progress = 0; },
    hud(scene, st) {
      if (scene.hasItem('transparent')) return { text: QT('demo', 'hudStehen', { n: Math.floor(st.data.progress), max: B('auftraege.demoStehenMin', 5) }) };
      return { text: QT('demo', 'hudBasteln', { k: scene.hasItem('karton') ? '✓' : '✗', s: scene.hasItem('stift') ? '✓' : '✗' }) };
    },
    target(scene) {
      if (scene.hasItem('transparent')) return tgtTile({ x: LOC.cafeFront.x, y: LOC.cafeFront.y + 1 });
      if (!scene.hasItem('karton')) return tgtActor('koch');
      if (!scene.hasItem('stift')) return tgtActor('michi');
      return null;
    },
    options(scene, st, a) {
      if (scene.hasItem('transparent')) return [];
      const o = [];
      if (a.id === 'koch' && !scene.hasItem('karton')) o.push({ label: QT('demo', 'karton'), fn: () => { scene.giveItem('karton'); scene.say(a, QT('demo', 'kartonText', null, 'Nimm. Aber ned gegen mi demonstrieren!')); } });
      if (a.id === 'michi' && !scene.hasItem('stift')) o.push({ label: QT('demo', 'stift'), fn: () => { scene.giveItem('stift'); scene.say(a, QT('demo', 'stiftText', null, 'Ein Stift schreibt. Ein Clown schweigt.')); } });
      return o;
    },
    update(scene, st, dt) {
      if (scene.hasItem('karton') && scene.hasItem('stift')) {
        scene.takeItem('karton'); scene.takeItem('stift'); scene.giveItem('transparent');
        UI.banner(QT('demo', 'gebastelt', null, 'Transparent gebastelt: „KAFFEE IS KA LUXUS!“'), 3000, 'info');
      }
      const p = scene.player;
      if (scene.hasItem('transparent') && !UI.isBlocking() && p.state === 'normal') {
        const c = { x: LOC.cafeFront.x * TILE + 8, y: (LOC.cafeFront.y + 1) * TILE + 8 };
        if (dist(p.x, p.y, c.x, c.y) < 40 && !isCafeFloor(p.x, p.y)) {
          st.data.progress += dt / (B('zeit.sekundenProStunde', 240) * 1000 / 60) * G.speed;
          if (Math.random() < dt / 3000) scene.say(p, QT('demo', 'ruf', null, 'KAFFEE IS KA LUXUS!'), 1500);
          if (st.data.progress >= B('auftraege.demoStehenMin', 5)) {
            scene.takeItem('transparent');
            scene.say(scene.actors.daniel, QT('demo', 'danielTobt', null, 'WAS SOLL DES?! Des is MEIN Gehsteig!'), 3500);
            UI.sms(scene.actors.daniel.name, QT('demo', 'sms', null, 'Wer demonstriert, zahlt doppelt. Ab morgen.'), 4000);
            Sfx.play('sms');
            Quests.complete('demo', B('auftraege.demo', 30), 0, QT('demo', 'erfolg', null, 'Demo gelungen! Daniel tobt.'));
          }
        }
      }
    }
  },

  // 10) Markus' Steckdose
  steckdose: {
    onStart(scene, st) { st.step = 'suchen'; },
    hud(scene, st) { return { text: QT('steckdose', st.step === 'suchen' ? (G.figur === 'markus' ? 'hudSelbst' : 'hud') : 'hudZurueck') }; },
    target(scene, st) { return st.step === 'suchen' ? tgtTile({ x: LOC.socket.x, y: LOC.socket.y - 1 }) : tgtActor('markus'); },
    options(scene, st, a) {
      if (st.step !== 'zurueck' || a.id !== 'markus') return [];
      return [{ label: QT('steckdose', 'melden'), fn: () => { UI.dialog(QL('steckdose', 'danke').map(t => ({ who: a.name, text: fmt(t) }))); Quests.complete('steckdose', B('auftraege.steckdose', 15)); } }];
    },
    inter(scene, st) {
      if (st.step !== 'suchen') return [];
      return [{ x: (LOC.socket.x + 0.5) * TILE, y: LOC.socket.y * TILE, r: 26, label: QT('steckdose', 'label', null, 'Steckdose prüfen'), fn: () => {
        if (G.figur === 'markus') { UI.dialog(QL('steckdose', 'selbst').map(t => ({ who: scene.player.name, text: fmt(t) }))); Quests.complete('steckdose', B('auftraege.steckdose', 15)); }
        else { st.step = 'zurueck'; UI.toast(QT('steckdose', 'gefunden', null, 'Steckdose gefunden! Sag\'s dem Markus.'), 'good'); }
      } }];
    }
  },

  // 11) Juliette kennt jeden
  gruesse: {
    onStart(scene, st) {
      const pool = ['didi', 'michi', 'koch', 'schlosser', 'opa', 'stern1', 'wirt', 'bobo'];
      st.data.todo = shuffle(pool).slice(0, B('auftraege.grussAnzahl', 4));
    },
    hud(scene, st) {
      const names = st.data.todo.map(id => Quests.act(id) ? Quests.act(id).name : id).join(', ');
      return { text: QT('gruesse', 'hud', { namen: names }) };
    },
    target(scene, st) {
      const p = scene.player;
      let best = null, bd = 1e9;
      for (const id of st.data.todo) { const a = Quests.act(id); if (a && a.present) { const d = dist(p.x, p.y, a.x, a.y); if (d < bd) { bd = d; best = a; } } }
      return best ? { actor: best } : null;
    },
    options(scene, st, a) {
      if (!st.data.todo.includes(a.id)) return [];
      return [{ label: QT('gruesse', G.figur === 'juliette' ? 'labelSelbst' : 'label'), fn: () => {
        st.data.todo = st.data.todo.filter(x => x !== a.id);
        scene.say(a, QT('gruesse', 'antwort', null, 'Ah, die Juliette! Grüß sie zurück!'), 2500);
        scene.addRep(B('auftraege.gruss', 5), QT('gruesse', 'kurz', null, 'Gruß'), { quest: true, talk: true });
        if (!st.data.todo.length) Quests.complete('gruesse', 0, 0, QT('gruesse', 'erfolg', null, 'Alle gegrüßt! Juliette kennt wirklich jeden.'));
      } }];
    }
  },

  // 12) Jewis Fotoauftrag
  foto: {
    onStart(scene, st) { if (G.figur !== 'jewi') scene.giveItem('kamera'); st.data.done = {}; },
    canShoot(scene) { return G.figur === 'jewi' || scene.hasItem('kamera'); },
    hud(scene, st) {
      if (!this.canShoot(scene)) return { text: QT('foto', 'hudKamera') };
      const d = st.data.done;
      return { text: QT('foto', 'hud', { q: d.quelle ? '✓' : '✗', p: d.pflaume ? '✓' : '✗', t: d.tesla ? '✓' : '✗' }) };
    },
    target(scene, st) {
      if (!this.canShoot(scene)) return tgtActor('jewi');
      const d = st.data.done;
      if (!d.quelle) return FOUNTAIN_PX();
      if (!d.pflaume) { const t = nearestPlum(scene); return t ? { x: t.x, y: t.y - 10 } : null; }
      if (!d.tesla) return tgtTile(LOC.tesla);
      return null;
    },
    shoot(scene, st, key) {
      st.data.done[key] = true;
      Sfx.play('photo');
      scene.cameras.main.flash(120, 255, 255, 255);
      UI.toast(QT('foto', 'klick_' + key, null, 'Klick!'), 'good');
      if (st.data.done.quelle && st.data.done.pflaume && st.data.done.tesla) {
        scene.takeItem('kamera');
        Quests.complete('foto', B('auftraege.foto', 25), 0, QT('foto', 'erfolg', null, 'Alle Motive im Kasten!'));
      }
    },
    options(scene, st, a) {
      if (a.id === 'jewi' && !this.canShoot(scene)) return [{ label: QT('foto', 'neueKamera'), fn: () => scene.giveItem('kamera') }];
      return [];
    },
    inter(scene, st) {
      if (!this.canShoot(scene)) return [];
      const l = [];
      const d = st.data.done;
      if (!d.quelle) { const f = FOUNTAIN_PX(); l.push({ x: f.x, y: f.y, r: 32, prio: -30, label: QT('foto', 'label_quelle', null, 'Foto: Quelle'), fn: () => this.shoot(scene, st, 'quelle') }); }
      if (!d.pflaume) for (const t of scene.objs.trees) if (t.kind === 'plum') l.push({ x: t.x, y: t.y - 4, r: 26, prio: -30, label: QT('foto', 'label_pflaume', null, 'Foto: Blutpflaume'), fn: () => this.shoot(scene, st, 'pflaume') });
      if (!d.tesla) { const t = LOC.tesla; l.push({ x: (t.x + 1) * TILE, y: (t.y + 0.5) * TILE, r: 34, prio: -30, label: QT('foto', 'label_tesla', null, 'Foto: Tesla'), fn: () => { this.shoot(scene, st, 'tesla'); scene.say(scene.actors.marco, QT('foto', 'marco', null, 'Tesla. MEINS. Weg.'), 2000); } }); }
      return l;
    }
  },

  // 13) Erwin ablenken
  erwin: {
    onStart(scene, st) {
      st.step = 'warten';
      const e = scene.actors.erwin;
      e.override = { tx: LOC.cafeFront.x, ty: LOC.cafeFront.y + 1, until: 99999 };
      e.path = null;
    },
    hud(scene, st) {
      if (st.step === 'warten') return { text: QT('erwin', 'hud') };
      const e = scene.actors.erwin;
      const d = Math.round(dist(e.x, e.y, LOC.cafeFront.x * TILE, LOC.cafeFront.y * TILE) / TILE);
      return { text: QT('erwin', 'hudLocken', { n: d, max: B('auftraege.erwinZielKacheln', 12) }) };
    },
    target(scene, st) { return st.step === 'warten' ? tgtActor('erwin') : null; },
    update(scene, st, dt) {
      const e = scene.actors.erwin, p = scene.player;
      const d = dist(e.x, e.y, p.x, p.y);
      if (st.step === 'warten') {
        if (d < 50 && e.atTile(LOC.cafeFront.x, LOC.cafeFront.y + 1, 2)) {
          st.step = 'locken';
          e.override = null; e.path = null;
          scene.say(e, QT('erwin', 'folgt', null, 'Wo gehst hin? Wart, i erzähl da no was!'), 2500);
          e.customUpdate = (dt2) => {
            const dd = dist(e.x, e.y, p.x, p.y);
            if (dd > 110) { if (Math.random() < dt2 / 3000) scene.say(e, QT('erwin', 'wartet', null, 'He! I war no ned fertig!'), 1800); return true; }
            if (dd > 14) e.moving = e.stepToward(p.x, p.y, dt2, 1.3);
            return true;
          };
        }
        return;
      }
      const away = dist(e.x, e.y, LOC.cafeFront.x * TILE + 8, LOC.cafeFront.y * TILE + 8) / TILE;
      if (away >= B('auftraege.erwinZielKacheln', 12)) {
        this.onEnd(scene, st);
        scene.say(e, QT('erwin', 'ende', null, 'Wo is mei Publikum hin?'), 2500);
        Quests.complete('erwin', B('auftraege.erwinAblenken', 30), 0, QT('erwin', 'erfolg', null, 'Erwin ist weit weg vom Café. Daniel atmet auf.'));
      }
    },
    onEnd(scene) { const e = scene.actors.erwin; e.customUpdate = null; e.override = null; e.path = null; }
  },

  // 14) Deewan-Lieferung
  lieferung: {
    onStart(scene, st) {
      scene.giveItem('lieferung', 3);
      st.data.until = G.realMs + B('auftraege.lieferungSek', 60) * 1000;
      st.data.delivered = [];
    },
    hud(scene, st) {
      const s = Math.max(0, Math.ceil((st.data.until - G.realMs) / 1000));
      return { text: QT('lieferung', 'hud', { n: st.data.delivered.length }), timer: s + ' s' };
    },
    target(scene, st) {
      const p = scene.player;
      let best = null, bd = 1e9;
      LOC.benches.forEach((b, i) => { if (st.data.delivered.includes(i)) return; const c = benchPx(i); const d = dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = c; } });
      return best;
    },
    inter(scene, st) {
      if (!scene.hasItem('lieferung')) return [];
      return LOC.benches.map((b, i) => {
        if (st.data.delivered.includes(i)) return null;
        const c = benchPx(i);
        return { x: c.x, y: c.y, r: 30, prio: -6, label: QT('lieferung', 'label', null, 'Essen abliefern'), fn: () => {
          scene.takeItem('lieferung');
          st.data.delivered.push(i);
          Sfx.play('coin');
          UI.toast(QT('lieferung', 'geliefert', { n: st.data.delivered.length }, 'Geliefert ({n}/3)'), 'good');
          if (st.data.delivered.length >= 3) Quests.complete('lieferung', B('auftraege.lieferung', 30), B('auftraege.lieferungGeld', 15), QT('lieferung', 'erfolg', null, 'Alles heiß angekommen!'));
        } };
      }).filter(Boolean);
    },
    update(scene, st) {
      if (G.realMs > st.data.until) {
        while (scene.takeItem('lieferung')) { /* weg damit */ }
        Quests.fail('lieferung', QT('lieferung', 'kalt', null, 'Zu spät – das Essen ist kalt!'), 15);
      }
    },
    onLost(scene, st, k) { /* Carla verliert eine Portion – dann wird's halt knapp */ }
  }
};

// Quelle: immer verfügbar (reinsteigen), nachts Rasiererin
const QDEF_ALWAYS = {
  inter(scene) {
    const f = FOUNTAIN_PX();
    return [{ x: f.x, y: f.y, r: 30, prio: 4, label: T('quelle.label', null, 'Quelle'), fn: () => {
      UI.dialog([{ who: '', text: T('quelle.frage', null, 'Die Quelle plätschert einladend. Reinsteigen?') }], { options: [
        { label: T('quelle.rein', { n: -B('ansehen.reinsteigenQuelle', -25) }, 'Rein da! (−{n} Ansehen)'), fn: () => {
          const p = scene.player;
          p.setState('wet', B('spieler.nassMin', 12));
          Sfx.play('splash');
          scene.addRep(B('ansehen.reinsteigenQuelle', -25), T('quelle.kurz', null, 'In der Quelle gebadet'));
          for (const a of scene.npcs) if (a.present && !a.isDog && a.state === 'normal' && dist(a.x, a.y, p.x, p.y) < 130) scene.say(a, T('quelle.grauslich', null, 'Grauslich!'), 2500);
        } },
        { label: T('quelle.nein', null, 'Lieber ned.'), fn: () => {} }
      ] });
    } }];
  }
};
