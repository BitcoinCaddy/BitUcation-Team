/* ============================================================
   app.js · Anmeldung, Router, Tabbar, Ereignisse
   ============================================================ */
(function(){
  'use strict';

  const App = {
    tab:'home', q:'', filter:'Alle', user:'', _hist:[],
    cache:{ person:[], task:[], content:[], course:[], note:[] }
  };
  window.App = App;

  App.get     = t => App.cache[t] || [];
  App.people  = () => App.cache.person;
  App.person  = id => App.cache.person.find(p => p.id === id) || {name:'–', role:'guest'};
  App.me      = () => App.person(App.user);
  App.byId    = id => { for(const t in App.cache){ const r = App.cache[t].find(x => x.id === id); if(r) return r; } return null; };

  async function reload(){
    for(const t of Object.keys(App.cache)) App.cache[t] = await Store.all(t);
    App.cache.person.sort((a,b) => a.name.localeCompare(b.name));
  }
  App.reload = reload;

  /* ============================================================
     Anmeldung: Nutzer-Trommel
     ============================================================ */
  let drumIdx = 0, drumPos = 0;

  function buildDrum(){
    const ps = App.people();
    return '<div class="login-brand"><span class="dot"></span>BitUcation <span class="muted" '
      + 'style="font-weight:400">Orga</span></div>'
      + '<div class="drum" id="drum"><div class="drum-track" id="track">'
      + ps.map(p => '<div class="ucard" data-id="'+p.id+'">'
          + '<div class="av">'+UI.esc(p.short || p.name.slice(0,2).toUpperCase())+'</div>'
          + '<div class="nm">'+UI.esc(p.name)+'</div>'
          + '<div class="rl">'+Views.ROLES[p.role].n+'</div></div>').join('')
      + '</div></div>'
      + '<button class="btn pri" id="loginGo" style="padding:.6rem 1.6rem">Anmelden</button>'
      + '<div class="login-hint">Wischen zum Wechseln</div>';
  }

  function applyDrum(pos, smooth){
    const cards = [...document.querySelectorAll('#track .ucard')], n = cards.length;
    cards.forEach((c, i) => {
      let d = i - pos;
      while(d >  n/2) d -= n;
      while(d < -n/2) d += n;
      const x = d * 118, s = Math.max(.72, 1 - Math.abs(d) * .17), o = Math.max(0, 1 - Math.abs(d) * .42);
      c.style.transition = smooth ? 'transform .28s cubic-bezier(.22,.8,.3,1), opacity .28s' : 'none';
      c.style.transform = 'translateX('+x+'px) scale('+s+')';
      c.style.opacity = o;
      c.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      c.classList.toggle('mid', Math.round(((pos % n) + n) % n) === i);
    });
  }

  function initLogin(){
    const v = document.getElementById('view-login');
    v.innerHTML = buildDrum(); v.classList.remove('hidden');
    document.getElementById('view-app').classList.add('hidden');

    const t = document.getElementById('drum');
    const cards = [...t.querySelectorAll('.ucard')], n = cards.length;
    if(!n) return;
    const last = Settings.get('currentUser','');
    drumIdx = Math.max(0, App.people().findIndex(p => p.id === last));
    drumPos = drumIdx;
    applyDrum(drumPos, false);

    let drag = false, x0 = 0, p0 = 0, step = 130, tick = drumIdx;
    const settle = target => {
      let tgt = target;
      while(tgt - drumPos >  n/2) tgt -= n;
      while(tgt - drumPos < -n/2) tgt += n;
      drumIdx = ((Math.round(tgt) % n) + n) % n;
      applyDrum(tgt, true);
      drumPos = drumIdx;
      UI.haptic(7);
    };
    t.addEventListener('pointerdown', ev => {
      drag = true; x0 = ev.clientX; p0 = drumPos; tick = drumIdx;
      try{ t.setPointerCapture(ev.pointerId); }catch(_){}
      t.classList.add('dragging'); ev.preventDefault();
    });
    t.addEventListener('pointermove', ev => {
      if(!drag) return;
      drumPos = p0 - (ev.clientX - x0) / step;
      const ni = ((Math.round(drumPos) % n) + n) % n;
      if(ni !== tick){ tick = ni; UI.haptic(4); }
      applyDrum(drumPos, false);
    });
    const up = () => { if(!drag) return; drag = false; t.classList.remove('dragging'); settle(Math.round(drumPos)); };
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);

    document.getElementById('loginGo').onclick = () => {
      const p = App.people()[drumIdx]; if(!p) return;
      App.user = p.id;
      Settings.set('currentUser', p.id);
      try{ sessionStorage.setItem('bitu.session', p.id); }catch(e){}
      v.classList.add('hidden');
      document.getElementById('view-app').classList.remove('hidden');
      App.tab = 'home'; App._hist = [];
      render();
      if(Sync.configured()) Sync.start();
    };
  }
  App.logout = () => { try{ sessionStorage.removeItem('bitu.session'); }catch(e){} initLogin(); };

  /* ============================================================
     Router
     ============================================================ */
  const TABS = [
    {id:'back', back:true},
    {id:'home', l:'Start',  ic:'home'},
    {id:'board',l:'Board',  ic:'board'},
    {id:'fab',  fab:true},
    {id:'plan', l:'Plan',   ic:'pen'},
    {id:'mehr', l:'Mehr',   ic:'more'},
    {id:'settings', l:'System', ic:'gear'}
  ];
  const SUB = {kurse:'mehr', wissen:'mehr', suche:'mehr', personen:'mehr'};
  const SEARCHABLE = new Set(['board','plan','kurse','wissen','suche']);
  const TITLE = {kurse:'Kurse', wissen:'Wissen', suche:'Suche', personen:'Personen'};

  App.go = (id, keep) => {
    if(id === App.tab){                       // Tipp auf den aktiven Reiter: nach oben
      const el = document.getElementById('view');
      if(el) el.scrollTo({top:0, behavior:'smooth'});
      UI.haptic(5); return;
    }
    if(!keep) App._hist.push(App.tab);
    App.tab = id;
    App.q = ''; App.filter = 'Alle';
    UI.haptic(6);
    const v = document.getElementById('view'); if(v) v.scrollTop = 0;
    render();
  };
  App.back = () => { const p = App._hist.pop(); if(p){ App.tab = p; App.q = ''; render(); } };

  function renderTabbar(){
    document.getElementById('tabbar').innerHTML = TABS.map(t => {
      if(t.fab) return '<div class="fabwrap"><button class="fab" id="fab" aria-label="Neu">'
        + UI.icon('plus') + '</button></div>';
      if(t.back) return '<button class="tab" data-back style="'
        + (App._hist.length ? '' : 'visibility:hidden;pointer-events:none') + '">'
        + UI.icon('back') + '<span class="tlbl">Zurück</span></button>';
      const active = (App.tab === t.id || SUB[App.tab] === t.id) ? ' active' : '';
      return '<button class="tab'+active+'" data-tab="'+t.id+'">'+UI.icon(t.ic)
        + '<span class="tlbl">'+t.l+'</span></button>';
    }).join('');
  }

  function renderAppbar(){
    const s = Sync.state();
    const cls = !s.on ? '' : s.state === 'verbunden' ? ' on'
      : (s.state === 'sendet' || s.state === 'gleicht ab') ? ' busy'
      : s.state === 'getrennt' ? ' err' : '';
    const pill = '<span class="pill'+cls+'" data-tab="settings"><span class="led"></span>'
      + UI.esc(s.on ? s.state : 'lokal') + '</span>';

    const bar = document.getElementById('appbar');
    if(SEARCHABLE.has(App.tab)){
      bar.innerHTML = '<input type="text" id="q" placeholder="Suchen …" value="'+UI.esc(App.q)+'" '
        + 'style="flex:1;min-width:0">' + pill;
    }else{
      bar.innerHTML = '<div class="ttl"><span class="dot"></span><span>'
        + UI.esc(TITLE[App.tab] || 'BitUcation Orga') + '</span></div><div class="grow"></div>'
        + pill + '<button class="iconbtn" data-tab="suche" aria-label="Suchen">'+UI.icon('search')+'</button>';
    }
  }

  function render(){
    renderAppbar(); renderTabbar();
    const fn = Views[App.tab] || Views.home;
    document.getElementById('view').innerHTML = fn();
    const q = document.getElementById('q');
    if(q && App.q){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  App.render = render;

  /* ============================================================
     Ereignisse
     ============================================================ */
  document.addEventListener('click', async ev => {
    const t = ev.target;

    if(t.closest('[data-ovclose]') && (t.hasAttribute('data-ovclose') || t.closest('button[data-ovclose]'))){
      UI.close(); return;
    }
    const fc = t.closest('[data-filter]');
    if(fc){ App.filter = fc.dataset.filter; UI.haptic(5); render(); return; }
    const tab = t.closest('[data-tab]');   if(tab){ App.go(tab.dataset.tab); return; }
    const go  = t.closest('[data-go]');    if(go){ App.go(go.dataset.go); return; }
    if(t.closest('[data-back]')){ App.back(); return; }
    if(t.closest('#fab')){ UI.haptic(10); Views.quickAdd(); return; }

    const nw = t.closest('[data-new]');
    if(nw){ const ty = nw.dataset.new; UI.close(); Views.edit(ty, null); return; }

    const mv = t.closest('[data-mv]');
    if(mv){
      ev.stopPropagation();
      const rec = App.byId(mv.dataset.id);
      const i = Views.COLS.indexOf(rec.status) + Number(mv.dataset.mv);
      if(i >= 0 && i < Views.COLS.length){
        rec.status = Views.COLS[i]; await Store.put(rec); UI.haptic(6); await reload(); render();
      }
      return;
    }

    const ed = t.closest('[data-edit]');
    if(ed){ Views.edit(ed.dataset.edit, ed.dataset.id); return; }

    /* --- Sheet --- */
    if(t.closest('#save')){
      const rec = Views.collectCur();
      if(!String(rec.title||'').trim()){ UI.toast('Ohne Titel geht es nicht'); return; }
      await Store.put(rec); UI.close(); await reload(); render(); UI.toast('Gespeichert'); return;
    }
    if(t.closest('#del')){
      const rec = Views.cur();
      UI.confirm('„'+rec.title+'“ wird entfernt.', async () => {
        await Store.remove(rec.id); await reload(); render(); UI.toast('Gelöscht');
      });
      return;
    }
    if(t.closest('#addLesson')){
      const rec = Views.collectCur();
      rec.lessons = (rec.lessons || []).concat([{id:Store.uuid(), t:'Neue Lektion', d:false}]);
      UI.close(); Views.edit('course', rec.id || null, rec); return;
    }
    const ld = t.closest('[data-ldel]');
    if(ld){
      const rec = Views.collectCur();
      rec.lessons = (rec.lessons || []).filter(l => l.id !== ld.dataset.ldel);
      UI.close(); Views.edit('course', rec.id || null, rec); return;
    }

    /* --- Personen --- */
    if(t.closest('#addPerson')){
      const n = document.getElementById('newPerson').value.trim(); if(!n) return;
      await Store.put({type:'person', name:n, role:'guest', short:n.slice(0,2).toUpperCase()});
      await reload(); render(); UI.toast('Person angelegt'); return;
    }
    const dp = t.closest('[data-delperson]');
    if(dp){
      if(App.people().length <= 1) return;
      UI.confirm('Diese Person wird entfernt.', async () => {
        await Store.remove(dp.dataset.delperson);
        await reload();
        if(!App.person(App.user).id) { App.user = App.people()[0].id; Settings.set('currentUser', App.user); }
        render();
      });
      return;
    }

    /* --- System --- */
    if(t.closest('#theme')){
      const d = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = d ? 'light' : 'dark';
      Settings.set('theme', d ? 'light' : 'dark'); render(); return;
    }
    if(t.closest('#syncIn')){
      Settings.set('syncUrl', document.getElementById('syncUrl').value.trim());
      const u = document.getElementById('syncUser').value.trim();
      const p = document.getElementById('syncPw').value;
      try{ await Sync.login(u, p); await reload(); render(); UI.toast('Verbunden'); }
      catch(err){ UI.toast(err.auth ? 'Name oder Passwort stimmt nicht' : 'Server nicht erreichbar'); }
      return;
    }
    if(t.closest('#syncNow')){ UI.toast('Gleiche ab …'); await Sync.full(); await reload(); render(); return; }
    if(t.closest('#syncOut')){ Sync.logout(); render(); return; }

    if(t.closest('#exp')){
      const all = await Store.raw();
      const blob = new Blob([JSON.stringify({app:'bitucation-orga', v:1, at:new Date().toISOString(), records:all}, null, 2)],
        {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'bitucation-orga-' + UI.today() + '.json';
      a.click(); URL.revokeObjectURL(a.href); UI.toast('Sicherung erstellt'); return;
    }
    if(t.closest('#imp')){ document.getElementById('impFile').click(); return; }
    if(t.closest('#reset')){
      UI.confirm('Alle lokalen Daten werden gelöscht und der Startbestand neu angelegt.', async () => {
        await Store.wipe(); await Store.seedIfEmpty(); await reload();
        App.user = App.people()[0].id; Settings.set('currentUser', App.user);
        render(); UI.toast('Zurückgesetzt');
      });
      return;
    }
  });

  document.addEventListener('change', async ev => {
    const t = ev.target;
    const r = t.closest('[data-role]');
    if(r){ const p = App.byId(r.dataset.role); p.role = t.value; await Store.put(p); await reload(); render(); return; }
    if(t.id === 'impFile' && t.files && t.files[0]){
      try{
        const d = JSON.parse(await t.files[0].text());
        const recs = d.records || d;
        if(!Array.isArray(recs)) throw new Error('Format');
        for(const r2 of recs) await Store.putRemote(r2);
        await reload(); render(); UI.toast(recs.length + ' Einträge eingespielt');
      }catch(err){ UI.toast('Datei nicht lesbar'); }
    }
  });

  document.addEventListener('input', ev => {
    if(ev.target.id === 'q'){
      App.q = ev.target.value;
      if(App.tab === 'suche' || SEARCHABLE.has(App.tab)){
        const fn = Views[App.tab] || Views.home;
        document.getElementById('view').innerHTML = fn();
      }
    }
  });

  /* Ziehen und Ablegen auf dem Board (Zeigegerät) */
  document.addEventListener('dragstart', ev => {
    const it = ev.target.closest('.item'); if(!it) return;
    ev.dataTransfer.setData('text/plain', it.dataset.id);
  });
  document.addEventListener('dragover', ev => {
    const c = ev.target.closest('.col'); if(!c) return;
    ev.preventDefault(); c.classList.add('drop');
  });
  document.addEventListener('dragleave', ev => {
    const c = ev.target.closest('.col'); if(c) c.classList.remove('drop');
  });
  document.addEventListener('drop', async ev => {
    const c = ev.target.closest('.col'); if(!c) return;
    ev.preventDefault(); c.classList.remove('drop');
    const rec = App.byId(ev.dataTransfer.getData('text/plain'));
    if(rec){ rec.status = c.dataset.col; await Store.put(rec); await reload(); render(); }
  });

  document.addEventListener('keydown', ev => { if(ev.key === 'Escape') UI.close(); });

  window.addEventListener('sync:data',  async () => { await reload(); render(); });
  window.addEventListener('sync:state', () => { if(!document.getElementById('view-app').classList.contains('hidden')) renderAppbar(); });

  /* ============================================================
     Start
     ============================================================ */
  (async () => {
    document.documentElement.dataset.theme = Settings.get('theme','light');
    await Store.ready();
    await reload();

    let sess = null;
    try{ sess = sessionStorage.getItem('bitu.session'); }catch(e){}
    const known = sess && App.people().some(p => p.id === sess);
    if(known){
      App.user = sess;
      document.getElementById('view-login').classList.add('hidden');
      document.getElementById('view-app').classList.remove('hidden');
      render();
      if(Sync.configured()) Sync.start();
    }else{
      initLogin();
    }

    if('serviceWorker' in navigator){
      try{ navigator.serviceWorker.register('sw.js'); }catch(e){}
    }
  })();
})();
