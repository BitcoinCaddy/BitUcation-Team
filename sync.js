/* ============================================================
   sync.js · Team-Sync über PocketBase

   Offline zuerst: Die App arbeitet immer auf der lokalen IndexedDB.
   Dieses Modul gleicht im Hintergrund ab.

     Push   lokale Änderungen wandern in eine Warteschlange und von
            dort als {cid, rtype, owner, payload, deleted} in die
            Server-Collection "records"
     Pull   fremde Änderungen (updated > letzter Abgleich) werden per
            Last-Write-Wins übernommen, verglichen wird payload.updatedAt
     Live   PocketBase-Realtime schiebt Änderungen sofort durch,
            Abruf alle 90 Sekunden als Rückfallebene

   Fällt der Server aus, läuft die App unverändert weiter.
   Ohne hinterlegte Serveradresse bleibt der Sync komplett aus.
   ============================================================ */
(function(){
  'use strict';

  const COLL = 'records';
  const base  = () => String(Settings.get('syncUrl','')||'').trim().replace(/\/+$/,'');
  const auth  = () => Settings.get('syncAuth', null);
  const ids   = () => Settings.get('syncIds', {});
  const setIds= m  => Settings.set('syncIds', m);
  const box   = () => Settings.get('syncOutbox', []);
  const setBox= a  => Settings.set('syncOutbox', a);

  let _state = 'aus', _err = '', _es = null, _flushT = null, _pollT = null, _busy = false;

  function emit(){ try{ window.dispatchEvent(new CustomEvent('sync:state')); }catch(e){} }
  function setState(s, err){ _state = s; _err = err || ''; emit(); }

  async function api(path, opts){
    const B = base();
    if(!B){ const e = new Error('keine Serveradresse'); e.noServer = true; throw e; }
    opts = opts || {};
    const h = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
    const a = auth(); if(a && a.token) h['Authorization'] = a.token;
    const r = await fetch(B + path, {
      method: opts.method || 'GET', headers: h,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let j = null; try{ j = await r.json(); }catch(e){}
    if(r.status === 401 || r.status === 403){ const e = new Error('nicht angemeldet'); e.auth = true; throw e; }
    if(!r.ok){ const e = new Error('HTTP ' + r.status); e.status = r.status; e.data = j; throw e; }
    return j;
  }

  const Sync = {

    configured(){ return !!base(); },
    loggedIn(){ const a = auth(); return !!(a && a.token); },
    state(){ return { on: Sync.configured(), state: _state, err: _err,
                      last: Settings.get('syncLast',''), pending: box().length,
                      user: (auth()||{}).name || '' }; },

    /* ---------- Anmeldung ---------- */
    async login(name, password){
      const identity = String(name||'').toLowerCase()
        .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
        .replace(/[^a-z0-9]/g,'') + '@bitucation.local';
      const j = await api('/api/collections/users/auth-with-password',
        { method:'POST', body:{ identity, password } });
      Settings.set('syncAuth', { token: j.token, id: j.record.id, name: name });
      setState('verbunden');
      await Sync.full();
      Sync.live();
      return true;
    },

    logout(){
      Settings.del('syncAuth');
      if(_es){ try{ _es.close(); }catch(e){} _es = null; }
      clearInterval(_pollT); _pollT = null;
      setState('aus');
    },

    /* ---------- Push ---------- */
    queue(rec){
      if(!Sync.configured()) return;
      const a = box().filter(x => x.id !== rec.id);
      a.push({ id: rec.id, at: Date.now() });
      setBox(a);
      clearTimeout(_flushT);
      _flushT = setTimeout(() => Sync.flush(), 1200);
    },

    async flush(){
      if(_busy || !Sync.configured() || !Sync.loggedIn()) return;
      const q = box(); if(!q.length) return;
      _busy = true; setState('sendet');
      const map = ids();
      const rest = [];
      for(const entry of q){
        try{
          const rec = await Store.get(entry.id);
          if(!rec) continue;
          const body = {
            cid: rec.id, rtype: rec.type, owner: rec.ownerId || '',
            payload: rec, deleted: !!rec.deleted
          };
          if(map[rec.id]){
            /* Schutz gegen Datenverlust nach langem Funkloch: liegt auf dem
               Server bereits eine neuere Fassung, wird die eigene alte NICHT
               darübergeschrieben. Der Pull holt die neuere danach herunter. */
            let srvRec = null;
            try{ srvRec = await api('/api/collections/'+COLL+'/records/'+map[rec.id]); }catch(e){}
            const srvAt = srvRec && srvRec.payload ? String(srvRec.payload.updatedAt||'') : '';
            if(srvAt && srvAt > String(rec.updatedAt||'')) continue;
            await api('/api/collections/'+COLL+'/records/'+map[rec.id], { method:'PATCH', body });
          }else{
            let srv = null;
            try{
              const f = await api('/api/collections/'+COLL+'/records?perPage=1&filter='
                + encodeURIComponent('cid="'+rec.id+'"'));
              if(f && f.items && f.items[0]) srv = f.items[0];
            }catch(e){}
            if(srv){
              await api('/api/collections/'+COLL+'/records/'+srv.id, { method:'PATCH', body });
              map[rec.id] = srv.id;
            }else{
              const j = await api('/api/collections/'+COLL+'/records', { method:'POST', body });
              map[rec.id] = j.id;
            }
          }
        }catch(e){
          if(e.auth){ _busy = false; setState('anmeldung nötig'); return; }
          rest.push(entry);
        }
      }
      setIds(map); setBox(rest);
      _busy = false;
      setState(rest.length ? 'wartet' : 'verbunden');
      if(!rest.length) Settings.set('syncLast', new Date().toISOString());
    },

    /* ---------- Pull ---------- */
    async pull(since){
      if(!Sync.configured() || !Sync.loggedIn()) return 0;
      const map = ids();
      let page = 1, changed = 0;
      const filter = since ? '&filter=' + encodeURIComponent('updated>"'+since+'"') : '';
      for(;;){
        const j = await api('/api/collections/'+COLL+'/records?perPage=200&page='+page+'&sort=updated'+filter);
        for(const it of (j.items||[])){
          const p = it.payload; if(!p || !p.id) continue;
          map[p.id] = it.id;
          const local = await Store.get(p.id);
          if(local && String(local.updatedAt||'') >= String(p.updatedAt||'')) continue;
          await Store.putRemote(Object.assign({}, p, { deleted: !!it.deleted }));
          changed++;
        }
        if(!j.totalPages || page >= j.totalPages) break;
        page++;
      }
      setIds(map);
      if(changed) try{ window.dispatchEvent(new CustomEvent('sync:data')); }catch(e){}
      return changed;
    },

    async full(){
      try{
        setState('gleicht ab');
        await Sync.flush();
        if(!_es) Sync.live();                       // Leitung nach Funkloch neu aufbauen
        const n = await Sync.pull(Settings.get('syncSince',''));
        Settings.set('syncSince', new Date().toISOString().replace('T',' ').slice(0,19));
        Settings.set('syncLast', new Date().toISOString());
        setState('verbunden');
        return n;
      }catch(e){
        setState(e.auth ? 'anmeldung nötig' : 'getrennt', e.message);
        return 0;
      }
    },

    /* ---------- Live ---------- */
    live(){
      if(!Sync.configured() || !Sync.loggedIn()) return;
      if(_es){ try{ _es.close(); }catch(e){} _es = null; }
      try{
        _es = new EventSource(base() + '/api/realtime');
        _es.addEventListener('PB_CONNECT', async ev => {
          try{
            const d = JSON.parse(ev.data);
            await api('/api/realtime', { method:'POST',
              body:{ clientId: d.clientId, subscriptions:[COLL] } });
            setState('verbunden');
          }catch(e){}
        });
        _es.addEventListener(COLL, async ev => {
          try{
            const d = JSON.parse(ev.data), it = d.record; if(!it || !it.payload) return;
            const p = it.payload;
            const local = await Store.get(p.id);
            if(local && String(local.updatedAt||'') >= String(p.updatedAt||'')) return;
            await Store.putRemote(Object.assign({}, p, { deleted: !!it.deleted }));
            window.dispatchEvent(new CustomEvent('sync:data'));
          }catch(e){}
        });
        _es.onerror = () => setState('getrennt');
      }catch(e){}

      clearInterval(_pollT);
      _pollT = setInterval(() => { if(navigator.onLine) Sync.full(); }, 90000);
    },

    start(){
      if(!Sync.configured()){ setState('aus'); return; }
      if(!Sync.loggedIn()){ setState('anmeldung nötig'); return; }
      Sync.full().then(() => Sync.live());
    }
  };

  window.addEventListener('online', () => {
    if(!Sync.configured() || !Sync.loggedIn()) return;
    if(_es){ try{ _es.close(); }catch(e){} _es = null; }   // tote Leitung verwerfen
    Sync.full().then(() => Sync.live());
  });
  window.addEventListener('offline', () => setState('getrennt'));
  window.Sync = Sync;
})();
