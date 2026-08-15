/* ============================================================
   views.js · alle Ansichten und Bearbeiten-Sheets
   ============================================================ */
(function(){
  'use strict';
  const V = {};
  const e = s => UI.esc(s);

  /* ---------- Stammdaten ---------- */
  const COLS   = ['Backlog','Diese Woche','In Arbeit','Review','Erledigt'];
  const CSTAT  = ['Idee','Recherche','Entwurf','Review','Geplant','Live'];
  const CTYPE  = ['Blogartikel','Newsletter','Video','Social','Podcast','Landingpage'];
  const KSTAT  = ['Konzept','Produktion','Review','Live','Pausiert'];
  const NKIND  = ['Notiz','Beschluss','Protokoll','Idee'];
  const AREAS  = ['Website','Content','Kurse','SEO','Finanzen','Recht','Community','Sonstiges'];
  V.COLS = COLS;

  const ROLES = {
    owner:  {n:'Inhaber',   c:{task:'w',content:'w',course:'w',note:'w',admin:'w'}},
    partner:{n:'Partner',   c:{task:'w',content:'w',course:'w',note:'w',admin:'r'}},
    editor: {n:'Redaktion', c:{task:'w',content:'w',course:'r',note:'r',admin:'-'}},
    guest:  {n:'Gast',      c:{task:'r',content:'r',course:'r',note:'-',admin:'-'}}
  };
  V.ROLES = ROLES;
  const can = (area, need) => {
    const u = App.me(); if(!u) return false;
    const lvl = (ROLES[u.role] || ROLES.guest).c[area] || '-';
    return need === 'w' ? lvl === 'w' : lvl !== '-';
  };
  V.can = can;

  /* ---------- Bausteine ---------- */
  const head = (t, s, a) => '<div class="head2"><div><h1>'+t+'</h1>'
    + (s ? '<div class="sub">'+s+'</div>' : '') + '</div><div class="grow"></div>'+(a||'')+'</div>';
  const sec = t => '<div class="sechead"><span class="label">'+e(t)+'</span></div>';

  const taskRow = t => '<div class="row" data-edit="task" data-id="'+t.id+'">'
    + '<div class="main"><div class="ti">'+e(t.title)+'</div><div class="sub2">'+e(t.status)
    + (t.due ? ' · <span class="'+(t.due < UI.today() && t.status!=='Erledigt' ? 'late':'')+'">'+UI.d(t.due)+'</span>' : '')
    + '</div></div></div>';

  /* ============================================================
     Start
     ============================================================ */
  V.home = () => {
    const me = App.me();
    const tasks = App.get('task'), cont = App.get('content'), crs = App.get('course');
    const open = tasks.filter(t => t.status !== 'Erledigt');
    const mine = open.filter(t => t.assignee === me.id)
                     .sort((a,b) => (a.due||'9').localeCompare(b.due||'9'));
    const late = open.filter(t => t.due && t.due < UI.today());
    const soon = cont.filter(c => c.publish && c.publish >= UI.today() && c.status !== 'Live')
                     .sort((a,b) => a.publish.localeCompare(b.publish)).slice(0,4);
    const prod = crs.filter(c => c.status === 'Produktion' || c.status === 'Konzept');

    const kpi = (v,l,al) => '<div class="card fade"><div class="label">'+l+'</div>'
      + '<div class="mono '+(al?'late':'')+'" style="font-size:1.8rem;margin-top:.15rem">'+v+'</div></div>';

    return '<div class="wrap">'
      + head('Moin <span style="color:var(--orange)">'+e(me.name)+'</span>',
             new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})
             + ' · ' + ROLES[me.role].n)
      + '<div class="grid g4">'
        + kpi(open.length,'Offen') + kpi(mine.length,'Bei dir')
        + kpi(late.length,'Überfällig', late.length>0)
        + kpi(cont.filter(c=>c.status!=='Live').length,'Inhalte in Arbeit')
      + '</div>'

      + sec('Deine nächsten Aufgaben')
      + (mine.length ? mine.slice(0,5).map(taskRow).join('')
                     : '<div class="empty">Nichts offen. Ungewöhnlich.</div>')

      + sec('Als Nächstes im Redaktionsplan')
      + (soon.length ? soon.map(c => '<div class="row" data-edit="content" data-id="'+c.id+'">'
          + '<div class="main"><div class="ti">'+e(c.title)+'</div>'
          + '<div class="sub2">'+e(c.ctype)+' · '+e(c.status)+'</div></div>'
          + '<span class="mono" style="font-size:.76rem;color:var(--muted)">'+UI.d(c.publish)+'</span></div>').join('')
        : '<div class="empty">Keine Termine geplant.</div>')

      + sec('Kurse in Arbeit')
      + (prod.length ? prod.map(courseRow).join('') : '<div class="empty">Keine Produktion aktiv.</div>')
      + '</div>';
  };

  /* ============================================================
     Board
     ============================================================ */
  V.board = () => {
    const w = can('task','w');
    const list = App.get('task').filter(t => UI.hit(t, App.q));
    const cols = COLS.map(col => {
      const items = list.filter(t => t.status === col);
      return '<div class="col" data-col="'+e(col)+'">'
        + '<div class="colhead">'+(col==='In Arbeit'?'<span class="dot"></span>':'')
        + '<span class="t">'+e(col)+'</span><span class="count">'+items.length+'</span></div>'
        + (items.map(t => {
            const i = COLS.indexOf(t.status);
            return '<div class="item fade" draggable="'+w+'" data-edit="task" data-id="'+t.id+'">'
              + '<div class="ti">'+e(t.title)+'</div><div class="meta">'
              + '<span class="tag">'+e(t.area||'–')+'</span><span>'+e(App.person(t.assignee).name)+'</span>'
              + (t.due ? '<span class="'+(t.due<UI.today()&&t.status!=='Erledigt'?'late':'')+'">'+UI.d(t.due)+'</span>' : '')
              + (Number(t.prio)===1 ? '<span class="badge">P1</span>' : '')
              + '</div>'
              + (w ? '<div class="mv"><button data-mv="-1" data-id="'+t.id+'"'+(i===0?' disabled':'')+'>‹</button>'
                   + '<button data-mv="1" data-id="'+t.id+'"'+(i===COLS.length-1?' disabled':'')+'>›</button></div>' : '')
              + '</div>';
          }).join('') || '<div class="muted" style="font-size:.7rem;padding:.3rem .2rem">leer</div>')
        + '</div>';
    }).join('');
    return '<div class="wrap">' + head('Board','Wischen für weitere Spalten') + '<div class="board">'+cols+'</div></div>';
  };

  /* ============================================================
     Redaktionsplan
     ============================================================ */
  V.plan = () => {
    const list = App.get('content').filter(c => UI.hit(c, App.q))
      .sort((a,b) => (a.publish||'9999').localeCompare(b.publish||'9999'));
    const f = App.filter || 'Alle';
    const chips = ['Alle'].concat(CSTAT).map(s =>
      '<button class="chip'+(f===s?' on':'')+'" data-filter="'+e(s)+'">'+e(s)+'</button>').join('');
    const vis = f === 'Alle' ? list : list.filter(c => c.status === f);

    const groups = {};
    vis.forEach(c => {
      const k = !c.publish ? 'Ohne Termin'
        : c.publish < UI.today() ? 'Überfällig'
        : c.publish <= isoPlus(7) ? 'Diese Woche'
        : c.publish <= isoPlus(30) ? 'Diesen Monat' : 'Später';
      (groups[k] = groups[k] || []).push(c);
    });
    const order = ['Überfällig','Diese Woche','Diesen Monat','Später','Ohne Termin'];

    return '<div class="wrap">' + head('Redaktionsplan','Von der Idee bis Live')
      + '<div class="chips">'+chips+'</div>'
      + (vis.length ? order.filter(k => groups[k]).map(k => sec(k) + groups[k].map(c =>
          '<div class="row fade" data-edit="content" data-id="'+c.id+'">'
          + '<div class="main"><div class="ti">'+e(c.title)+'</div>'
          + '<div class="sub2">'+e(c.ctype)+' · '+e(c.channel||'–')+' · '+e(App.person(c.owner).name)
          + (c.keyword ? ' · Keyword: '+e(c.keyword) : '') + '</div></div>'
          + '<span class="tag">'+e(c.status)+'</span>'
          + '<span class="mono" style="font-size:.74rem;color:var(--muted)">'
          + (c.publish ? UI.d(c.publish) : '–') + '</span></div>').join('')).join('')
        : '<div class="empty">Nichts gefunden.</div>')
      + '</div>';
  };
  const isoPlus = d => { const x = new Date(); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };

  /* ============================================================
     Kurse
     ============================================================ */
  const courseRow = c => {
    const ls = c.lessons || [], done = ls.filter(l => l.d).length, n = ls.length || 1;
    return '<div class="row fade" data-edit="course" data-id="'+c.id+'"><div class="main">'
      + '<div class="ti">'+e(c.title)+'</div><div class="sub2">'+e(c.status)+' · '
      + e(App.person(c.owner).name)+' · '+done+' von '+ls.length+' Lektionen'
      + (c.target ? ' · Ziel '+UI.d(c.target) : '') + '</div>'
      + '<div class="bar"><i style="width:'+Math.round(done/n*100)+'%"></i></div></div>'
      + '<span class="mono" style="font-size:.88rem">'+Math.round(done/n*100)+'%</span></div>';
  };

  V.kurse = () => {
    const list = App.get('course').filter(c => UI.hit(c, App.q));
    return '<div class="wrap">' + head('Kursproduktion','Module, Lektionen, Fortschritt')
      + (list.length ? list.map(courseRow).join('') : '<div class="empty">Nichts gefunden.</div>') + '</div>';
  };

  /* ============================================================
     Wissen
     ============================================================ */
  V.wissen = () => {
    if(!can('note','r')) return '<div class="wrap"><div class="empty">Für diesen Bereich fehlt der Rolle „'
      + e(ROLES[App.me().role].n) + '“ der Zugriff.</div></div>';
    const list = App.get('note').filter(n => UI.hit(n, App.q))
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
    return '<div class="wrap">' + head('Wissen und Beschlüsse','Protokolle, Gesellschafterbeschlüsse, Notizen')
      + (list.length ? list.map(n => '<div class="row fade" data-edit="note" data-id="'+n.id+'">'
          + '<div class="main"><div class="ti">'+e(n.title)+'</div>'
          + '<div class="sub2">'+UI.dLong(n.date)+(n.people ? ' · '+e(n.people) : '')+'</div>'
          + '<div class="sub2" style="margin-top:.3rem;color:var(--text);opacity:.72">'
          + e((n.body||'').slice(0,110))+((n.body||'').length>110?'…':'')+'</div></div>'
          + (n.kind==='Beschluss' ? '<span class="badge">Beschluss</span>' : '<span class="tag">'+e(n.kind)+'</span>')
          + '</div>').join('')
        : '<div class="empty">Nichts gefunden.</div>') + '</div>';
  };

  /* ============================================================
     Mehr
     ============================================================ */
  V.mehr = () => {
    const me = App.me();
    const link = (id, ic, t, s) => '<div class="row" data-go="'+id+'">'
      + '<span class="ic" style="width:36px;height:36px;border-radius:10px;border:1px solid var(--border);'
      + 'display:grid;place-items:center;color:var(--muted);flex:0 0 auto">'+UI.icon(ic)+'</span>'
      + '<div class="main"><div class="ti">'+t+'</div><div class="sub2">'+s+'</div></div></div>';
    return '<div class="wrap">' + head('Mehr', e(me.name)+' · '+ROLES[me.role].n)
      + link('kurse','school','Kursproduktion', App.get('course').length + ' Module')
      + (can('note','r') ? link('wissen','note','Wissen und Beschlüsse', App.get('note').length + ' Einträge') : '')
      + link('suche','search','Suche','Alles auf einmal durchsuchen')
      + link('personen','users','Personen', App.people().length + ' Konten')
      + '</div>';
  };

  /* ============================================================
     Suche
     ============================================================ */
  V.suche = () => {
    const q = App.q;
    if(!q) return '<div class="wrap">' + head('Suche','Begriff oben eingeben')
      + '<div class="empty">Tippe oben in das Suchfeld.</div></div>';
    const hits = [
      ['Aufgaben','task',  App.get('task').filter(x => UI.hit(x,q))],
      ['Inhalte', 'content',App.get('content').filter(x => UI.hit(x,q))],
      ['Kurse',   'course', App.get('course').filter(x => UI.hit(x,q))],
      ['Wissen',  'note',   can('note','r') ? App.get('note').filter(x => UI.hit(x,q)) : []]
    ].filter(h => h[2].length);
    if(!hits.length) return '<div class="wrap">' + head('Suche','„'+e(q)+'“')
      + '<div class="empty">Kein Treffer.</div></div>';
    return '<div class="wrap">' + head('Suche','„'+e(q)+'“ · '
      + hits.reduce((a,h) => a+h[2].length, 0) + ' Treffer')
      + hits.map(([lbl, tp, arr]) => sec(lbl) + arr.map(x =>
          '<div class="row" data-edit="'+tp+'" data-id="'+x.id+'"><div class="main">'
          + '<div class="ti">'+e(x.title)+'</div>'
          + '<div class="sub2">'+e(x.status||x.kind||'')+'</div></div></div>').join('')).join('')
      + '</div>';
  };

  /* ============================================================
     Personen
     ============================================================ */
  V.personen = () => {
    const admin = can('admin','w');
    return '<div class="wrap">' + head('Personen','Rollen steuern nur die Anzeige')
      + '<div class="warn" style="margin-bottom:1rem">Solange kein Sync-Server eingerichtet ist, sind diese '
      + 'Rollen reine Oberflächenlogik und keine Zugriffskontrolle. Erst PocketBase setzt sie serverseitig durch.</div>'
      + App.people().map(p => '<div class="row flat">'
          + '<span style="width:38px;height:38px;border-radius:50%;background:var(--surface2);display:grid;'
          + 'place-items:center;font-family:var(--head);font-weight:800;font-size:.85rem;color:var(--muted);'
          + 'flex:0 0 auto">'+e(p.short||p.name.slice(0,2).toUpperCase())+'</span>'
          + '<div class="main"><div class="ti">'+e(p.name)+'</div>'
          + '<div class="sub2">'+ROLES[p.role].n+'</div></div>'
          + (admin ? '<select data-role="'+p.id+'" style="max-width:140px">'
              + Object.keys(ROLES).map(r => '<option value="'+r+'"'+(p.role===r?' selected':'')+'>'
              + ROLES[r].n+'</option>').join('') + '</select>'
              + '<button class="btn sm danger" data-delperson="'+p.id+'">Entfernen</button>' : '')
          + '</div>').join('')
      + (admin ? '<div style="display:flex;gap:.5rem;margin-top:.8rem">'
          + '<input type="text" id="newPerson" placeholder="Name der neuen Person">'
          + '<button class="btn" id="addPerson">Anlegen</button></div>' : '')
      + '</div>';
  };

  /* ============================================================
     System
     ============================================================ */
  V.settings = () => {
    const s = Sync.state();
    const theme = document.documentElement.dataset.theme;
    return '<div class="wrap">' + head('System','Sync, Darstellung, Daten')

      + sec('Team-Sync')
      + '<div class="card stack">'
        + '<div class="sub" style="margin:0">Ohne Serveradresse bleibt alles auf diesem Gerät. '
        + 'Mit PocketBase teilen sich alle denselben Stand, offline weiterarbeiten inklusive.</div>'
        + '<div class="fg"><span class="label">Serveradresse</span>'
        + '<input type="text" id="syncUrl" placeholder="https://sync.beispiel.de" value="'
        + e(Settings.get('syncUrl','')) + '"></div>'
        + (Sync.loggedIn()
            ? '<div class="row flat" style="margin:0"><div class="main"><div class="ti">Angemeldet als '
              + e(s.user) + '</div><div class="sub2">Status: '+e(s.state)+' · letzter Abgleich '
              + UI.rel(s.last) + (s.pending ? ' · '+s.pending+' wartend' : '') + '</div></div>'
              + '<button class="btn" id="syncNow">Jetzt abgleichen</button>'
              + '<button class="btn danger" id="syncOut">Abmelden</button></div>'
            : '<div class="fg"><span class="label">Anmeldename</span>'
              + '<input type="text" id="syncUser" value="'+e(App.me().name)+'"></div>'
              + '<div class="fg"><span class="label">Passwort</span>'
              + '<input type="password" id="syncPw" placeholder="vom Admin vergeben"></div>'
              + '<div class="acts" style="margin-top:.9rem"><div class="grow"></div>'
              + '<button class="btn pri" id="syncIn">Verbinden</button></div>')
      + '</div>'

      + sec('Darstellung')
      + '<div class="card"><div class="row flat" style="margin:0;border:none;padding:0;background:none">'
        + '<div class="main"><div class="ti">Dunkles Design</div>'
        + '<div class="sub2">Aktuell: '+(theme==='dark'?'dunkel':'hell')+'</div></div>'
        + '<button class="btn" id="theme">'+UI.icon(theme==='dark'?'sun':'moon')
        + ' Umschalten</button></div></div>'

      + sec('Daten')
      + '<div class="card"><div class="acts" style="margin:0">'
        + '<button class="btn" id="exp">'+UI.icon('down')+' Sicherung</button>'
        + '<button class="btn" id="imp">'+UI.icon('up')+' Einspielen</button>'
        + '<input type="file" id="impFile" accept="application/json" style="display:none">'
        + '<div class="grow"></div>'
        + (can('admin','w') ? '<button class="btn danger" id="reset">Zurücksetzen</button>' : '')
        + '</div></div>'

      + sec('Über')
      + '<div class="card"><div class="sub" style="margin:0;line-height:1.6">BitUcation Orga v1 · '
      + 'Offline zuerst, IndexedDB lokal, optionaler Abgleich über PocketBase. '
      + 'Keine externen Aufrufe, keine Schriften von fremden Servern, kein Tracking.</div></div>'
      + '<div style="text-align:center;font-size:.62rem;color:var(--muted);margin-top:1.2rem">'
      + 'Built with 🧡 by BitUcation · Keine externen Quellen · Abgleich alle 90 s</div>'
      + '</div>';
  };

  /* ============================================================
     Bearbeiten
     ============================================================ */
  const FORMS = {
    task:{ t:'Aufgabe', area:'task', f:[
      {k:'title',l:'Titel',t:'text',ph:'Was ist zu tun?'},
      {k:'status',l:'Status',t:'select',o:COLS},
      {k:'assignee',l:'Zuständig',t:'person'},
      {k:'area',l:'Bereich',t:'select',o:AREAS},
      {k:'prio',l:'Priorität',t:'select',o:[1,2,3],labels:['1 hoch','2 normal','3 später']},
      {k:'due',l:'Fällig',t:'date'},
      {k:'notes',l:'Notizen',t:'area'}]},
    content:{ t:'Inhalt', area:'content', f:[
      {k:'title',l:'Titel',t:'text'},
      {k:'ctype',l:'Format',t:'select',o:CTYPE},
      {k:'status',l:'Status',t:'select',o:CSTAT},
      {k:'owner',l:'Verantwortlich',t:'person'},
      {k:'channel',l:'Kanal',t:'text',ph:'Blog, Mail, YouTube …'},
      {k:'keyword',l:'Fokus-Keyword',t:'text'},
      {k:'publish',l:'Veröffentlichung',t:'date'},
      {k:'notes',l:'Notizen',t:'area'}]},
    course:{ t:'Kurs', area:'course', f:[
      {k:'title',l:'Titel',t:'text'},
      {k:'status',l:'Status',t:'select',o:KSTAT},
      {k:'owner',l:'Verantwortlich',t:'person'},
      {k:'target',l:'Zieltermin',t:'date'},
      {k:'notes',l:'Notizen',t:'area'}]},
    note:{ t:'Eintrag', area:'note', f:[
      {k:'title',l:'Titel',t:'text'},
      {k:'kind',l:'Art',t:'select',o:NKIND},
      {k:'date',l:'Datum',t:'date'},
      {k:'people',l:'Beteiligte',t:'text'},
      {k:'body',l:'Inhalt',t:'area'},
      {k:'tags',l:'Schlagworte',t:'text'}]}
  };

  const blank = type => {
    const me = App.me().id;
    if(type==='task')    return {type,title:'',status:'Backlog',assignee:me,area:'Sonstiges',prio:2,due:'',notes:''};
    if(type==='content') return {type,title:'',ctype:'Blogartikel',status:'Idee',owner:me,channel:'Blog',keyword:'',publish:'',notes:''};
    if(type==='course')  return {type,title:'',status:'Konzept',owner:me,target:'',notes:'',lessons:[]};
    if(type==='note')    return {type,kind:'Notiz',title:'',date:UI.today(),people:App.me().name,body:'',tags:''};
  };

  let cur = null;

  V.edit = (type, id, preset) => {
    const f = FORMS[type]; if(!f) return;
    const ro = !can(f.area,'w');
    const rec = preset || (id ? App.byId(id) : blank(type));
    if(!rec) return;
    cur = JSON.parse(JSON.stringify(rec));

    let extra = '';
    if(type === 'course'){
      const ls = cur.lessons || [];
      extra = '<div class="fg"><span class="label">Lektionen</span><div id="lessons">'
        + ls.map(l => '<div class="row flat" style="padding:.4rem .6rem;margin-bottom:.35rem">'
            + '<input type="checkbox" data-lc="'+l.id+'"'+(l.d?' checked':'')+(ro?' disabled':'')
            + ' style="width:auto;flex:0 0 auto">'
            + '<div class="main"><input type="text" data-lt="'+l.id+'" value="'+e(l.t)+'"'+(ro?' disabled':'')
            + ' style="border:none;background:none;padding:.1rem 0"></div>'
            + (ro?'':'<button class="btn sm danger" data-ldel="'+l.id+'">×</button>') + '</div>').join('')
        + '</div>' + (ro?'':'<button class="btn sm" id="addLesson" style="margin-top:.3rem">+ Lektion</button>')
        + '</div>';
    }

    UI.sheet('<h3>'+(id ? e(f.t)+' bearbeiten' : 'Neu: '+e(f.t))+'</h3>'
      + (ro ? '<div class="sub" style="margin-top:.3rem">Deine Rolle darf hier nur lesen.</div>' : '')
      + f.f.map(fd => UI.field(fd, cur[fd.k], ro)).join('')
      + extra
      + '<div class="acts">'
      + (!ro && id ? '<button class="btn danger" id="del">Löschen</button>' : '')
      + '<div class="grow"></div><button class="btn" data-ovclose>Schließen</button>'
      + (ro ? '' : '<button class="btn pri" id="save">Speichern</button>') + '</div>');
  };

  V.collectCur = () => {
    UI.collect(cur);
    if(cur.type === 'course'){
      const arr = [];
      document.querySelectorAll('#sheet-host [data-lt]').forEach(el => {
        const lid = el.dataset.lt;
        const cb = document.querySelector('#sheet-host [data-lc="'+lid+'"]');
        arr.push({id:lid, t:el.value, d: cb ? cb.checked : false});
      });
      cur.lessons = arr;
    }
    return cur;
  };
  V.cur = () => cur;
  V.setCur = r => { cur = r; };

  /* Schnellauswahl über den runden Knopf */
  V.quickAdd = () => {
    const opt = [
      ['task','board','Aufgabe','Auf das Board'],
      ['content','pen','Inhalt','In den Redaktionsplan'],
      ['course','school','Kurs','Neues Modul'],
      ['note','note','Notiz oder Beschluss','Ins Wissen']
    ].filter(o => can(FORMS[o[0]].area,'w'));
    if(!opt.length){ UI.toast('Deine Rolle darf nichts anlegen'); return; }
    UI.sheet('<h3>Neu anlegen</h3><div style="margin-top:.6rem">'
      + opt.map(([t,ic,l,s]) => '<div class="pickrow" data-new="'+t+'">'
          + '<span class="ic">'+UI.icon(ic)+'</span><div><div style="font-weight:600;font-size:.9rem">'+l+'</div>'
          + '<div class="sub2" style="font-size:.7rem;color:var(--muted)">'+s+'</div></div></div>').join('')
      + '</div>');
  };

  window.Views = V;
})();
