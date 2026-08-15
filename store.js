/* ============================================================
   store.js · Lokaler Datenspeicher (IndexedDB)
   Record-Modell, sync-fähig:
     { id, type, ownerId, createdAt, updatedAt, deleted, ...payload }
   Alles läuft offline. sync.js gleicht im Hintergrund ab.
   ============================================================ */
(function(){
  'use strict';

  /* ---------- Settings (localStorage) ---------- */
  const P = 'bitu.';
  const Settings = {
    get(k, def){ try{ const v = localStorage.getItem(P+k); return v === null ? def : JSON.parse(v); }catch(e){ return def; } },
    set(k, v){ try{ localStorage.setItem(P+k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem(P+k); }catch(e){} }
  };
  window.Settings = Settings;

  /* ---------- IndexedDB ---------- */
  const DBN = 'bitucation-orga', VER = 1, ST = 'records';
  let _db = null;

  function open(){
    return new Promise((res, rej) => {
      const rq = indexedDB.open(DBN, VER);
      rq.onupgradeneeded = e => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains(ST)){
          const os = db.createObjectStore(ST, {keyPath:'id'});
          os.createIndex('type','type',{unique:false});
        }
      };
      rq.onsuccess = e => { _db = e.target.result; res(_db); };
      rq.onerror  = e => rej(e.target.error);
    });
  }
  const tx = mode => _db.transaction(ST, mode).objectStore(ST);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
                    : 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2));

  const Store = {
    uuid,

    async ready(){
      if(!_db) await open();
      await Store.seedIfEmpty();
      return true;
    },

    all(type){
      return new Promise((res, rej) => {
        const out = [], rq = tx('readonly').index('type').openCursor(IDBKeyRange.only(type));
        rq.onsuccess = e => { const c = e.target.result;
          if(c){ if(!c.value.deleted) out.push(c.value); c.continue(); } else res(out); };
        rq.onerror = e => rej(e.target.error);
      });
    },

    raw(){
      return new Promise((res, rej) => {
        const out = [], rq = tx('readonly').openCursor();
        rq.onsuccess = e => { const c = e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
        rq.onerror = e => rej(e.target.error);
      });
    },

    get(id){
      return new Promise((res, rej) => {
        const rq = tx('readonly').get(id);
        rq.onsuccess = e => res(e.target.result || null);
        rq.onerror = e => rej(e.target.error);
      });
    },

    /* Schreiben mit Sync-Meldung */
    put(rec){
      const now = new Date().toISOString();
      const r = Object.assign({
        id: rec.id || uuid(), createdAt: rec.createdAt || now, deleted: false,
        ownerId: rec.ownerId || Settings.get('currentUser','')
      }, rec, { updatedAt: now });
      return Store._write(r).then(() => { try{ if(window.Sync) Sync.queue(r); }catch(e){} return r; });
    },

    /* Schreiben ohne Sync-Meldung (Gegenrichtung: Server → lokal) */
    putRemote(rec){ return Store._write(rec).then(() => rec); },

    _write(r){
      return new Promise((res, rej) => {
        const rq = tx('readwrite').put(r);
        rq.onsuccess = () => res(true);
        rq.onerror = e => rej(e.target.error);
      });
    },

    async remove(id){
      const r = await Store.get(id); if(!r) return false;
      r.deleted = true; r.updatedAt = new Date().toISOString();
      await Store._write(r);
      try{ if(window.Sync) Sync.queue(r); }catch(e){}
      return true;
    },

    wipe(){
      return new Promise((res, rej) => {
        const rq = tx('readwrite').clear();
        rq.onsuccess = () => res(true); rq.onerror = e => rej(e.target.error);
      });
    },

    /* Startbestand: feste IDs und ein fester, alter Zeitstempel.
       Dadurch legen zwei Geraete nicht zweimal dieselben Demodaten an, und ein
       spaeter dazukommendes Geraet ueberschreibt nichts, was das Team laengst
       geaendert oder geloescht hat. Der Startbestand wird nie hochgeladen,
       weil hier _write statt put benutzt wird. */
    async seedIfEmpty(){
      const p = await Store.all('person');
      if(p.length) return;
      for(const r of SEED) await Store._write(Object.assign({
        createdAt: SEED_TS, updatedAt: SEED_TS, deleted:false, ownerId:'sys'
      }, r));
    }
  };
  window.Store = Store;

  /* ---------- Startbestand ---------- */
  const SEED_TS = '2026-01-01T00:00:00.000Z';
  const iso = d => { const x = new Date(); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
  const SEED = [
    {id:'person-caddy',  type:'person', name:'Caddy',  role:'owner',   short:'CA'},
    {id:'person-bianca', type:'person', name:'Bianca', role:'partner', short:'BI'},
    {id:'person-markus', type:'person', name:'Markus', role:'partner', short:'MA'},
    {id:'person-gast',   type:'person', name:'Gast',   role:'guest',   short:'GA'},

    {id:'seed-task-1', type:'task', title:'Hero-Slider Plugin auf v1.7 heben', status:'In Arbeit',
      assignee:'person-caddy', area:'Website', prio:2, due:iso(4),
      notes:'Fokuspunkt-Regler für den Tablet-Breakpoint ergänzen.'},
    {id:'seed-task-2', type:'task', title:'Sitemap in der Search Console nachziehen', status:'Diese Woche',
      assignee:'person-caddy', area:'SEO', prio:2, due:iso(6), notes:''},
    {id:'seed-task-3', type:'task', title:'Trust-Elemente auf der Startseite entscheiden', status:'Review',
      assignee:'person-bianca', area:'Website', prio:1, due:iso(2),
      notes:'Alternative zur Medien-Logoleiste abstimmen.'},
    {id:'seed-task-4', type:'task', title:'Newsletter-Anmeldung auf DSGVO prüfen', status:'Backlog',
      assignee:'person-markus', area:'Recht', prio:3, due:'', notes:''},
    {id:'seed-task-5', type:'task', title:'Videokonferenz-Lösung festlegen', status:'Erledigt',
      assignee:'person-markus', area:'Sonstiges', prio:2, due:iso(-3),
      notes:'Ergebnis ist als Beschluss abgelegt.'},

    {id:'seed-content-1', type:'content', title:'Bitcoin vererben: Was Erben wirklich brauchen', ctype:'Blogartikel',
      status:'Entwurf', owner:'person-bianca', keyword:'bitcoin vererben', publish:iso(9), channel:'Blog',
      notes:'Zahlt direkt auf Kursmodul 5 ein.'},
    {id:'seed-content-2', type:'content', title:'Newsletter August: Seed-Backup Grundlagen', ctype:'Newsletter',
      status:'Geplant', owner:'person-caddy', keyword:'', publish:iso(3), channel:'Mail', notes:''},
    {id:'seed-content-3', type:'content', title:'Hardware-Wallet Vergleich 2026', ctype:'Blogartikel',
      status:'Recherche', owner:'person-markus', keyword:'hardware wallet vergleich', publish:iso(21),
      channel:'Blog', notes:'Aktuelle Sicherheitslage einarbeiten.'},
    {id:'seed-content-4', type:'content', title:'Kurzvideo: Was eine Wallet wirklich ist', ctype:'Video',
      status:'Idee', owner:'person-bianca', keyword:'', publish:'', channel:'YouTube', notes:''},

    {id:'seed-course-1', type:'course', title:'Modul 1 · Bitcoin kaufen', status:'Live', owner:'person-caddy',
      target:'', notes:'', lessons:[{id:'seed-x-1',t:'Börsen und KYC',d:true},{id:'seed-x-2',t:'Der erste Kauf',d:true},
      {id:'seed-x-3',t:'Abzug auf die eigene Wallet',d:true}]},
    {id:'seed-course-2', type:'course', title:'Modul 4 · Bitcoin sicher aufbewahren', status:'Produktion',
      owner:'person-markus', target:iso(30), notes:'Hardware-Wallet Praxisteil filmen.',
      lessons:[{id:'seed-x-4',t:'Seed verstehen',d:true},{id:'seed-x-5',t:'Backup-Strategien',d:true},
      {id:'seed-x-6',t:'Multisig Einstieg',d:false},{id:'seed-x-7',t:'Praxis: Ersteinrichtung',d:false}]},
    {id:'seed-course-3', type:'course', title:'Modul 5 · Bitcoin vererben', status:'Konzept', owner:'person-bianca',
      target:iso(75), notes:'Alleinstellungsmerkmal. Hier lohnt sich Zeit.',
      lessons:[{id:'seed-x-8',t:'Rechtlicher Rahmen',d:false},{id:'seed-x-9',t:'Zugriffskonzept für Erben',d:false},
      {id:'seed-x-10',t:'Dokumentenvorlage',d:false}]},

    {id:'seed-note-1', type:'note', kind:'Beschluss', title:'Videokonferenz künftig selbst gehostet',
      date:iso(-3), people:'Caddy, Bianca, Markus', tags:'GbR, Infrastruktur',
      body:'Einstimmig beschlossen. Begründung: DSGVO und Unabhängigkeit von US-Anbietern. Umsetzung bis Quartalsende.'},
    {id:'seed-note-2', type:'note', kind:'Protokoll', title:'Monatsrunde Juli', date:iso(-14),
      people:'Caddy, Bianca, Markus', tags:'GbR',
      body:'Themen: Reichweite, Kursfahrplan, Zertifizierung. Nächster Termin steht.'},
    {id:'seed-note-3', type:'note', kind:'Idee', title:'Zertifikat als öffentlich prüfbares Register',
      date:iso(-20), people:'Caddy', tags:'Produkt',
      body:'Verifizierbarkeit ohne zentrale Instanz weiter als Unterscheidungsmerkmal ausbauen.'}
  ];
})();
