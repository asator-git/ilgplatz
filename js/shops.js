// ---------------------------------------------------------------
// shops.js – Läden & Sonderangebote (Café, Deewan, Marco, Stern, …)
// ---------------------------------------------------------------
'use strict';

const Shops = {
  kickCd: 0,

  optionsFor(scene, a) {
    const o = [];
    const S = (k, v, fb) => T('shops.' + k, v, fb);
    switch (a.id) {
      case 'daniel': {
        const pr = scene.price('americano');
        if (G.freeCoffee > 0) o.push({ label: S('americanoGratis', null, 'Americano (gratis – für dich, Juliette)'), fn: () => { G.freeCoffee--; scene.giveItem('americano'); UI.dialog([{ who: a.name, text: S('gratisDanke', null, 'Für dich, ma chérie. Einmal. Sag’s keinem.') }]); } });
        o.push({ label: S('americano', { preis: euro(pr) }, 'Americano ({preis})'), fn: () => { if (scene.pay(pr, S('americanoKurz', null, 'Americano'))) { scene.giveItem('americano'); scene.say(a, S('bitteschoen', null, 'Bitte. Trinkgeld geht extra.')); } } });
        const kp = scene.price('kipferl');
        o.push({ label: S('kipferl', { preis: euro(kp) }, 'Kipferl ({preis})'), fn: () => { if (scene.pay(kp, S('kipferlKurz', null, 'Kipferl'))) scene.giveItem('kipferl'); } });
        break;
      }
      case 'koch': {
        const pr = B('preise.deewan', [0, 5, 15]);
        o.push({ label: S('deewanEssen', null, 'Essen holen – zahl, was du willst'), fn: () => this.deewan(scene, a, pr) });
        break;
      }
      case 'marco': {
        if (G.marcoHired) o.push({ label: S('marcoEntlassen', null, 'Marco, geh ham. Danke.'), fn: () => { G.marcoHired = false; const m = scene.actors.marco; m.follow = null; m.path = null; scene.say(m, S('marcoTschuess', null, 'Hm.')); } });
        else {
          const c = B('preise.marco', 50);
          o.push({ label: S('marcoAnheuern', { preis: euro(c) }, 'Marco als Bodyguard anheuern ({preis})'), fn: () => {
            if (!scene.pay(c, S('marcoKurz', null, 'Marco'))) return;
            G.marcoHired = true;
            const m = scene.actors.marco; m.data.nextKo = G.minute + B('gegner.marcoErledigtAlleMin', 20);
            UI.dialog([{ who: a.name, text: S('marcoJa', null, 'Gut. Ich geh mit. Wer dich anschaut… Ich hab schon mal…') }]);
            UI.toast(S('marcoHinweis', null, 'Marco beschützt dich vor Exen und Nadja. Aber er „erledigt“ ab und zu wen…'), '');
          } });
        }
        break;
      }
      case 'wirt': {
        const open = G.minute >= parseClock(B('events.nachtStart', '21:00'), 1260);
        if (open && !G.flags.spritzer) {
          const c = B('preise.spritzer', 4);
          o.push({ label: S('spritzer', { preis: euro(c) }, 'An Spritzer, bitte ({preis})'), fn: () => {
            if (!scene.pay(c, S('spritzerKurz', null, 'Spritzer'))) return;
            G.flags.spritzer = true;
            scene.addRep(B('ansehen.dezentral', 10), S('dezentralKurz', null, 'Dezentral'));
            UI.dialog([{ who: a.name, text: S('spritzerText', null, 'Prost. Jetzt gehörst dazu.') }]);
          } });
        }
        break;
      }
      case 'stern1': {
        const night = G.minute >= parseClock(B('events.nachtStart', '21:00'), 1260);
        if (night && !G.flags.shitAngebot) {
          o.push({ label: S('shitAnnehmen', null, '„An Shit? … Ja, gib her.“'), fn: () => {
            G.flags.shitAngebot = true;
            scene.giveItem('shit');
            scene.addRep(B('ansehen.sternAnnehmen', 15), S('sternKurz', null, 'Respekt am Stern'));
            UI.dialog([{ who: a.name, text: S('shitDanke', null, 'Passt. Und lass di ned von der Kiwara erwischen.') }]);
          } });
          o.push({ label: S('shitAblehnen', null, '„Na danke, passt scho.“'), fn: () => { G.flags.shitAngebot = true; scene.say(a, S('shitOk', null, 'Wie du willst.')); } });
        }
        break;
      }
      case 'rasiererin': {
        if (!G.flags.rasiererin) o.push({ label: S('zuhoeren', null, 'Hinsetzen und zuhören'), fn: () => {
          G.flags.rasiererin = true;
          UI.dialog(TL('shops.rasiererinGeschichte', ['…']).map(t => ({ who: a.name, text: t })), { onClose: () => scene.addRep(B('ansehen.rasiererin', 5), S('zuhoerenKurz', null, 'Zugehört')) });
        } });
        break;
      }
    }
    return o;
  },

  deewan(scene, a, prices) {
    const opts = prices.map((p, i) => ({
      label: T('shops.deewanPreis' + i, { preis: euro(p) }, 'Ich zahl {preis}'),
      fn: () => {
        if (p > 0 && !scene.pay(p, T('shops.deewanKurz', null, 'Deewan'))) return;
        scene.giveItem('essen');
        if (i === prices.length - 1) { scene.addRep(B('ansehen.deewan15', 10), T('shops.grosszuegig', null, 'großzügig')); scene.say(a, T('shops.deewanDanke', null, 'Oh! Danke, mein Freund!')); }
        else if (p === 0) { scene.addRep(B('ansehen.deewan0', -10), T('shops.geizig', null, 'geizig')); UI.dialog([{ who: a.name, text: T('npc.koch.traurig', null, '(Der Koch schaut traurig.)') }]); }
        else scene.say(a, T('shops.deewanNormal', null, 'Passt. Guten Appetit!'));
        if (G.figur === 'andi') UI.toast(T('shops.andiHinweis', null, 'Tipp: E drücken = jausnen'), '');
      }
    }));
    UI.dialog([{ who: a.name, text: T('shops.deewanFrage', null, 'Pay as you wish! Was ist es dir wert?') }], { options: opts });
  },

  // Ohne Geld ins Café? Daniel wirft dich raus.
  update(scene) {
    const p = scene.player;
    if (G.ended || p.state === 'hospital' || UI.isBlocking()) return;
    if (G.money < B('ansehen.ohneGeldSchwelle', 1) && isCafeFloor(p.x, p.y) && tileAt(scene.grid, p.x, p.y) !== TI.DOOR && G.realMs > this.kickCd) {
      this.kickCd = G.realMs + 30000;
      scene.addRep(-B('ansehen.ohneGeldImCafe', 10), T('shops.rausKurz', null, 'Ohne Geld im Café'));
      UI.dialog([{ who: scene.actors.daniel.name, text: T('shops.raus', null, 'Ohne Geld? In MEINER Society? Raus!') }], {
        onClose: () => scene.teleportPlayer(LOC.cafeFront.x, LOC.cafeFront.y + 1)
      });
    }
  }
};
