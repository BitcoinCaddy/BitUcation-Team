/* ============================================================
   ui.js · gemeinsame Helfer für alle Ansichten
   ============================================================ */
(function(){
  'use strict';
  const UI = {};

  /* ---------- Icons (Tabler-Stil, selbst gezeichnet, keine Fremdquelle) ---------- */
  const P = {
    home:'M5 12l-2 0l9 -9l9 9l-2 0M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
    board:'M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1zM14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    pen:'M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4M13.5 6.5l4 4',
    more:'M4 6h16M4 12h16M4 18h16',
    gear:'M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065zM9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
    plus:'M12 5v14M5 12h14',
    back:'M15 6l-6 6l6 6',
    check:'M5 12l5 5l10 -10',
    school:'M22 9l-10 -4l-10 4l10 4l10 -4v6M6 10.6v5.4a6 3 0 0 0 12 0v-5.4',
    note:'M14 3v4a1 1 0 0 0 1 1h4M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2M9 9h1M9 13h6M9 17h6',
    users:'M9 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M3 21v-2a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v2',
    search:'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6',
    cloud:'M12 18.004h-5.343c-2.572 -.004 -4.657 -2.011 -4.657 -4.487c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-6.535',
    moon:'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z',
    sun:'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M3 12h1M12 3v1M20 12h1M12 20v1M5.6 5.6l.7 .7M18.4 5.6l-.7 .7M17.7 17.7l.7 .7M6.3 17.7l-.7 .7',
    down:'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M7 11l5 5l5 -5M12 4v12',
    up:'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M7 9l5 -5l5 5M12 4v12',
    out:'M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2M9 12h12l-3 -3M18 15l3 -3'
  };
  UI.icon = (n, cls) => '<svg class="'+(cls||'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'
    + (P[n]||'') + '"/></svg>';

  /* ---------- Kleinkram ---------- */
  UI.esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  UI.today = () => new Date().toISOString().slice(0,10);
  UI.d = s => s ? new Date(s+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) : '';
  UI.dLong = s => s ? new Date(s+'T00:00').toLocaleDateString('de-DE',
    {day:'2-digit',month:'long',year:'numeric'}) : '';
  UI.rel = iso => {
    if(!iso) return 'nie';
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if(m < 1) return 'gerade eben';
    if(m < 60) return 'vor ' + m + ' min';
    if(m < 1440) return 'vor ' + Math.floor(m/60) + ' h';
    return new Date(iso).toLocaleDateString('de-DE');
  };
  UI.hit = (o, q) => !q || JSON.stringify(o).toLowerCase().includes(q.toLowerCase());
  UI.haptic = ms => { try{ if(navigator.vibrate) navigator.vibrate(ms||8); }catch(e){} };

  let _tt;
  UI.toast = msg => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('on'), 2300);
  };

  /* ---------- Sheet ---------- */
  UI.sheet = (html, onMount) => {
    const host = document.getElementById('sheet-host');
    host.innerHTML = '<div class="ov" data-ovclose><div class="sheet"><div class="grip"></div>'+html+'</div></div>';
    if(onMount) onMount(host);
  };
  UI.close = () => { document.getElementById('sheet-host').innerHTML = ''; };

  /* ---------- Formularfelder ---------- */
  UI.field = (fd, val, ro) => {
    const dis = ro ? ' disabled' : '';
    const v = val ?? '';
    let ctl = '';
    if(fd.t === 'text')  ctl = '<input type="text" data-f="'+fd.k+'" value="'+UI.esc(v)+'"'+dis
                             + (fd.ph ? ' placeholder="'+UI.esc(fd.ph)+'"' : '') + '>';
    if(fd.t === 'date')  ctl = '<input type="date" data-f="'+fd.k+'" value="'+UI.esc(v)+'"'+dis+'>';
    if(fd.t === 'area')  ctl = '<textarea data-f="'+fd.k+'"'+dis+'>'+UI.esc(v)+'</textarea>';
    if(fd.t === 'select')ctl = '<select data-f="'+fd.k+'"'+dis+'>' + fd.o.map((o,i) =>
        '<option value="'+UI.esc(o)+'"'+(String(v)===String(o)?' selected':'')+'>'
        + UI.esc(fd.labels ? fd.labels[i] : o) + '</option>').join('') + '</select>';
    if(fd.t === 'person')ctl = '<select data-f="'+fd.k+'"'+dis+'>' + App.people().map(p =>
        '<option value="'+p.id+'"'+(v===p.id?' selected':'')+'>'+UI.esc(p.name)+'</option>').join('') + '</select>';
    return '<div class="fg"><span class="label">'+UI.esc(fd.l)+'</span>'+ctl+'</div>';
  };

  UI.collect = rec => {
    document.querySelectorAll('#sheet-host [data-f]').forEach(el => {
      rec[el.dataset.f] = el.value;
    });
    return rec;
  };

  UI.confirm = (text, cb) => {
    UI.sheet('<h3>Sicher?</h3><div class="sub" style="margin-top:.4rem">'+UI.esc(text)+'</div>'
      + '<div class="acts"><div class="grow"></div>'
      + '<button class="btn" data-ovclose>Abbrechen</button>'
      + '<button class="btn danger" id="yes">Ja, löschen</button></div>');
    document.getElementById('yes').onclick = () => { UI.close(); cb(); };
  };

  window.UI = UI;
})();
