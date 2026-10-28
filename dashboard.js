/* EDP Reports - VCA overview for supervisors and the administrator */
(() => {
  'use strict';
  const { t, esc, toast } = EDP;
  const $ = s => document.querySelector(s);
  const TARGET = EDPAuth.CONFIG.target;
  let me = null, profiles = [], reports = [], manual = {}, logo = null;
  EDP.imageData('assets/edp-logo.jpg').then(d => { logo = d; });

  const now = new Date(), thisYear = now.getFullYear();
  $('#yearSel').innerHTML = [thisYear, thisYear - 1, thisYear - 2].map(y => `<option>${y}</option>`).join('');

  /* How many inspections someone should have by today to stay on track (12 per year = 1 per month). */
  const tgt = p => (p && p.vca_target != null) ? p.vca_target : TARGET;
  function expectedBy(year, T = TARGET) {
    if (year < thisYear) return T;
    if (year > thisYear) return 0;
    return Math.floor(T * (now.getMonth() + 1) / 12);
  }
  function statusPill(n, year, T = TARGET) {
    if (n >= T) return `<span class="pill ok">${esc(t('dashReached'))}</span>`;
    return n >= expectedBy(year, T) ? `<span class="pill track">${esc(t('dashOnTrack'))}</span>` : `<span class="pill behind">${esc(t('dashBehind'))}</span>`;
  }
  const nameOf = id => { const p = profiles.find(x => x.id === id); return p ? (p.full_name || p.email) : '?'; };

  async function loadData() {
    const y = Number($('#yearSel').value);
    $('#saveStatus').textContent = '…';
    try {
      let man;
      [profiles, reports, man] = await Promise.all([
        EDPAuth.rest('profiles?select=id,email,full_name,role,vca_target&order=full_name'),
        EDPAuth.rest(`reports?select=id,user_id,project,location,report_date,ok_count,nok_count,na_count,open_count&module=eq.safety&report_date=gte.${y}-01-01&report_date=lte.${y}-12-31&order=report_date.desc`),
        EDPAuth.rest(`vca_manual_counts?select=user_id,count,note&year=eq.${y}`).catch(() => [])
      ]);
      manual = {}; man.forEach(m => { manual[m.user_id] = m; });
      $('#saveStatus').textContent = new Date().toLocaleTimeString(I18N.lang, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { toast(t('dashLoadError'), 4000); $('#saveStatus').textContent = ''; }
    const cur = $('#projSel').value;
    const projects = [...new Set(reports.map(r => r.project.trim()))].sort((a, b) => a.localeCompare(b));
    $('#projSel').innerHTML = `<option value="">${esc(t('dashAllProjects'))}</option>` + projects.map(p => `<option ${p === cur ? 'selected' : ''}>${esc(p)}</option>`).join('');
    render();
  }

  function render() {
    const y = Number($('#yearSel').value), proj = $('#projSel').value;
    const rows = proj ? reports.filter(r => r.project.trim() === proj) : reports;
    $('#dashIntro').textContent = t('dashIntro', { t: TARGET });
    $('#expected').textContent = t('dashExpected', { n: expectedBy(y) });

    /* Per person: everyone with an account, also those with 0 inspections.
       Inspections done outside the app (entered by the administrator) count too, but are not linked to a project. */
    const admin = me.role === 'admin', useManual = !proj;
    $('#manualHint').textContent = useManual ? t(admin ? 'manHintAdmin' : 'manHint') : t('manHintProject');
    const per = profiles.map(p => { const app = rows.filter(r => r.user_id === p.id).length, man = useManual ? ((manual[p.id] || {}).count || 0) : 0; return { p, app, man, n: app + man, T: tgt(p) }; })
      .sort((a, b) => a.n - b.n || (a.p.full_name || a.p.email).localeCompare(b.p.full_name || b.p.email));
    $('#tPeople').innerHTML = `<thead><tr><th>${esc(t('dashPerson'))}</th><th>${esc(t('dashProgress'))}</th>${useManual ? `<th>${esc(t('manCol'))}</th>` : ''}<th class="hide-sm">${esc(t('dashRole'))}</th></tr></thead><tbody>` +
      (per.length ? per.map(({ p, app, man, n, T }) => `<tr><td><strong>${esc(p.full_name || '—')}</strong><br><small class="muted">${esc(p.email)}</small></td>
        <td class="prog"><div class="prog-top"><strong>${n} / ${T}</strong>${statusPill(n, y, T)}</div><div class="mini-bar"><span class="${n >= T ? 'done' : ''}" style="width:${T ? Math.min(100, Math.round(n / T * 100)) : 100}%"></span></div>${man ? `<small class="muted">${esc(t('manSplit', { a: app, m: man }))}</small>` : ''}</td>
        ${useManual ? `<td class="man">${admin ? `<input type="number" inputmode="numeric" min="0" max="365" step="1" class="man-input" data-man="${p.id}" value="${man || ''}" placeholder="0" aria-label="${esc(t('manCol'))}">` : `<span class="num">${man}</span>`}</td>` : ''}
        <td class="hide-sm">${esc(t('role_' + p.role))}${T !== TARGET ? `<br><small class="muted">${esc(t('setTargetShort', { n: T }))}</small>` : ''}</td></tr>`).join('')
        : `<tr><td colspan="4" class="muted">${esc(t('dashNone'))}</td></tr>`) + '</tbody>';
    document.querySelectorAll('[data-man]').forEach(inp => inp.onchange = () => saveManual(inp, y));

    /* Per project */
    const byProj = {};
    rows.forEach(r => { const k = r.project.trim(); (byProj[k] ??= { n: 0, people: new Set(), nok: 0, last: r.report_date }); byProj[k].n++; byProj[k].people.add(r.user_id); byProj[k].nok += r.nok_count; if (r.report_date > byProj[k].last) byProj[k].last = r.report_date; });
    const projRows = Object.entries(byProj).sort((a, b) => b[1].n - a[1].n);
    $('#tProjects').innerHTML = `<thead><tr><th>${esc(t('dashProject'))}</th><th class="num">${esc(t('dashCount'))}</th><th class="num">${esc(t('dashPerson'))}</th><th class="num">NOK</th><th class="hide-sm">${esc(t('dashDate'))}</th></tr></thead><tbody>` +
      (projRows.length ? projRows.map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td class="num">${v.n}</td><td class="num">${v.people.size}</td><td class="num">${v.nok}</td><td class="hide-sm">${esc(v.last)}</td></tr>`).join('')
        : `<tr><td colspan="5" class="muted">${esc(t('dashNone'))}</td></tr>`) + '</tbody>';

    /* All inspections */
    $('#tReports').innerHTML = `<thead><tr><th>${esc(t('dashDate'))}</th><th>${esc(t('dashPerson'))}</th><th>${esc(t('dashProject'))}</th><th class="hide-sm">${esc(t('dashLocation'))}</th><th class="num">NOK</th></tr></thead><tbody>` +
      (rows.length ? rows.map(r => `<tr><td>${esc(r.report_date)}</td><td>${esc(nameOf(r.user_id))}</td><td>${esc(r.project)}</td><td class="hide-sm">${esc(r.location || '')}</td><td class="num">${r.nok_count ? `<span class="pill behind">${r.nok_count}</span>` : '0'}</td></tr>`).join('')
        : `<tr><td colspan="5" class="muted">${esc(t('dashNone'))}</td></tr>`) + '</tbody>';

    $('#kTotal').textContent = rows.length + per.reduce((s, x) => s + x.man, 0);
    $('#kReached').textContent = `${per.filter(x => x.n >= x.T).length} / ${per.length}`;
    $('#kProjects').textContent = projRows.length;
  }

  async function saveManual(inp, y) {
    const id = inp.dataset.man, v = inp.value.trim() === '' ? 0 : Math.round(Number(inp.value));
    if (!Number.isFinite(v) || v < 0 || v > 365) { toast(t('manInvalid')); inp.value = (manual[id] || {}).count || ''; return; }
    inp.disabled = true;
    try {
      if (v === 0) { await EDPAuth.rest(`vca_manual_counts?user_id=eq.${id}&year=eq.${y}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); delete manual[id]; }
      else {
        const r = await EDPAuth.rest('vca_manual_counts?on_conflict=user_id,year', { method: 'POST', body: { user_id: id, year: y, count: v }, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
        if (!Array.isArray(r) || !r[0]) throw new Error('not saved');
        manual[id] = r[0];
      }
      toast(t('manSaved')); render();
    } catch (e) { toast(t('setSaveError'), 4000); inp.disabled = false; inp.value = (manual[id] || {}).count || ''; }
  }

  /* ---------- VCA report as PDF with charts (A4) ---------- */
  function vcaPdf() {
    const y = Number($('#yearSel').value), proj = $('#projSel').value;
    const rows = proj ? reports.filter(r => r.project.trim() === proj) : reports;
    const per = profiles.map(p => { const app = rows.filter(r => r.user_id === p.id).length, man = proj ? 0 : ((manual[p.id] || {}).count || 0), T = tgt(p), n = app + man;
      const st = n >= T ? 'reached' : n >= expectedBy(y, T) ? 'track' : 'behind'; return { name: p.full_name || p.email, app, man, n, T, st }; })
      .sort((a, b) => (a.n / (a.T || 1)) - (b.n / (b.T || 1)) || a.name.localeCompare(b.name));
    const COL = { navy: '#272e3b', teal: '#14a9bb', green: '#2fae4e', red: '#b42318', grey: '#e4e9ee', ink: '#17212b', muted: '#5f6c78', line: '#d9e1e7', violet: '#6041ed' };
    const stCol = { reached: COL.green, track: COL.teal, behind: COL.red };
    const stTxt = { reached: t('dashReached'), track: t('dashOnTrack'), behind: t('dashBehind') };
    const title = t('vrTitle', { y }), doc = new TinyPDF({ title });
    const M = 15, W = 180; let yy = 0;
    const page = () => { EDP.pdfHeader(doc, title, logo); yy = 34; };
    const ensure = h => { if (yy + h > 278) { doc.addPage(); page(); } };
    const heading = s => { ensure(16); doc.text(s, M, yy, 12.5, 'bold', COL.navy); yy += 8; };
    const fit = (s, w, size) => { s = String(s); while (s.length > 1 && doc.textWidth(s, size) > w) s = s.slice(0, -2) + '…'; return s; };
    page();
    const dateStr = new Date().toLocaleDateString(I18N.lang, { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(t('vrSubtitle', { d: dateStr }), M, yy, 10, 'normal', COL.muted); yy += 5;
    doc.text(proj ? t('vrProject', { p: proj }) : t('dashAllProjects'), M, yy, 10, 'bold', COL.ink); yy += 8;

    /* KPI tiles */
    const reached = per.filter(p => p.st === 'reached').length, nok = rows.reduce((s, r) => s + (r.nok_count || 0), 0);
    const projects = new Set(rows.map(r => r.project.trim())).size, total = rows.length + per.reduce((s, p) => s + p.man, 0);
    const kpis = [[String(total), t('dashCount'), COL.navy], [`${reached} / ${per.length}`, t('dashReachedKpi'), COL.green], [String(projects), t('dashProjects'), COL.teal], [String(nok), t('vrNokFound'), COL.red]];
    const kw = (W - 3 * 4) / 4;
    kpis.forEach(([v, l, c], i) => { const x = M + i * (kw + 4); doc.rect(x, yy, kw, 20, '#f2f5f8'); doc.rect(x, yy, 1.4, 20, c); doc.text(v, x + 5, yy + 9.5, 17, 'bold', c); doc.text(fit(l, kw - 8, 7.5), x + 5, yy + 16, 7.5, 'normal', COL.muted); });
    yy += 28;

    /* Chart 1: progress per person (horizontal bars against personal target) */
    heading(t('vrChartPeople'));
    const lx = M, lw = 48, bx = M + lw + 2, bw = 104, maxT = Math.max(1, ...per.map(p => Math.max(p.T, p.n)));
    const legend = [['reached', stTxt.reached], ['track', stTxt.track], ['behind', stTxt.behind]];
    let gx = M; legend.forEach(([k, l]) => { doc.rect(gx, yy - 2.6, 3, 3, stCol[k]); doc.text(l, gx + 4.5, yy, 8, 'normal', COL.muted); gx += doc.textWidth(l, 8) + 12; });
    doc.rect(gx, yy - 2.6, 3, 3, COL.grey); doc.text(t('vrTargetBar'), gx + 4.5, yy, 8, 'normal', COL.muted); yy += 6;
    per.forEach(p => {
      ensure(8);
      doc.text(fit(p.name, lw, 8.5), lx, yy + 3.3, 8.5, 'normal', COL.ink);
      doc.rect(bx, yy, bw * p.T / maxT, 4.6, COL.grey);
      if (p.n) doc.rect(bx, yy, bw * Math.min(p.n, maxT) / maxT, 4.6, stCol[p.st]);
      doc.text(`${p.n} / ${p.T}`, bx + bw + 3, yy + 3.4, 8.5, 'bold', stCol[p.st]);
      yy += 7.2;
    });
    yy += 6;

    /* Chart 2: inspections per month (via app) */
    ensure(70); heading(t('vrChartMonth'));
    const months = Array.from({ length: 12 }, (_, i) => rows.filter(r => Number(r.report_date.slice(5, 7)) === i + 1).length);
    const mMax = Math.max(1, ...months), ch = 42, cx = M + 8, cw = W - 10, top = yy + 2, base = top + ch;
    const step = Math.max(1, Math.ceil(mMax / 4));
    for (let v = 0; v <= mMax; v += step) { const gy = base - ch * v / mMax; doc.line(cx, gy, cx + cw, gy, COL.line, .2); doc.text(String(v), cx - 2, gy + 1, 7, 'normal', COL.muted, 'right'); }
    const slot = cw / 12, barW = slot * 0.6;
    months.forEach((v, i) => {
      const x = cx + i * slot + (slot - barW) / 2, h = ch * v / mMax;
      if (v) { doc.rect(x, base - h, barW, h, (y === thisYear && i > now.getMonth()) ? COL.grey : COL.teal); doc.text(String(v), x + barW / 2, base - h - 1.5, 7.5, 'bold', COL.navy, 'center'); }
      doc.text(new Date(2000, i, 1).toLocaleDateString(I18N.lang, { month: 'short' }).replace('.', ''), x + barW / 2, base + 4.5, 7.5, 'normal', COL.muted, 'center');
    });
    yy = base + 9;
    if (!proj && per.some(p => p.man)) { doc.text(t('vrNoteManual'), M, yy, 7.5, 'normal', COL.muted); yy += 5; }
    yy += 4;

    /* Chart 3: per project */
    const byProj = {}; rows.forEach(r => { const k = r.project.trim(); (byProj[k] ??= { n: 0, nok: 0 }); byProj[k].n++; byProj[k].nok += r.nok_count || 0; });
    const pr = Object.entries(byProj).sort((a, b) => b[1].n - a[1].n);
    if (pr.length) {
      ensure(20 + pr.length * 7); heading(t('vrChartProjects'));
      const pMax = Math.max(1, ...pr.map(([, v]) => v.n));
      pr.forEach(([k, v]) => {
        ensure(8);
        doc.text(fit(k, lw, 8.5), lx, yy + 3.3, 8.5, 'normal', COL.ink);
        doc.rect(bx, yy, bw * v.n / pMax, 4.6, COL.violet);
        doc.text(`${v.n}` + (v.nok ? `  ·  ${v.nok} NOK` : ''), bx + bw * v.n / pMax + 3, yy + 3.4, 8.5, 'bold', v.nok ? COL.red : COL.navy);
        yy += 7.2;
      });
      yy += 6;
    }

    /* Table per person */
    ensure(30); heading(t('vrTable'));
    const cols = [[t('dashPerson'), 58, 'left'], [t('manViaApp'), 22, 'right'], [t('manCol'), 24, 'right'], [t('dashTotal'), 20, 'right'], [t('setTarget'), 26, 'right'], ['', 30, 'right']];
    const head = () => { let x = M; doc.rect(M, yy - 4.2, W, 6.4, '#f2f5f8'); cols.forEach(([h, w, a]) => { doc.text(fit(h, w - 2, 7.5), a === 'right' ? x + w - 1 : x + 1, yy, 7.5, 'bold', COL.muted, a); x += w; }); yy += 6; };
    head();
    [...per].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
      if (yy + 7 > 278) { doc.addPage(); page(); head(); }
      let x = M; const vals = [fit(p.name, 56, 8.5), String(p.app), String(p.man), String(p.n), String(p.T), stTxt[p.st]];
      cols.forEach(([, w, a], i) => { doc.text(vals[i], a === 'right' ? x + w - 1 : x + 1, yy, 8.5, i === 5 || i === 3 ? 'bold' : 'normal', i === 5 ? stCol[p.st] : COL.ink, a); x += w; });
      doc.line(M, yy + 2.2, M + W, yy + 2.2, COL.line, .15); yy += 6.4;
    });
    yy += 4; ensure(10);
    doc.text(t('vrExpected', { n: expectedBy(y) }), M, yy, 7.5, 'normal', COL.muted);
    EDP.pdfFooter(doc);
    return doc.output();
  }

  function csv() {
    const y = $('#yearSel').value, proj = $('#projSel').value;
    const rows = proj ? reports.filter(r => r.project.trim() === proj) : reports;
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = [t('dashDate'), t('dashPerson'), 'E-mail', t('dashProject'), t('dashLocation'), 'OK', 'NOK', 'N/A', t('notChecked')];
    const summary = [[t('dashPerson'), 'E-mail', t('manViaApp'), t('manCol'), t('dashTotal'), t('setTarget'), 'VCA OK'].map(q).join(';'),
      ...profiles.map(p => { const app = rows.filter(r => r.user_id === p.id).length, man = proj ? 0 : ((manual[p.id] || {}).count || 0); return [p.full_name, p.email, app, man, app + man, tgt(p), app + man >= tgt(p) ? 'OK' : ''].map(q).join(';'); }), ''];
    const lines = [...summary, head.map(q).join(';'), ...rows.map(r => { const p = profiles.find(x => x.id === r.user_id) || {}; return [r.report_date, p.full_name, p.email, r.project, r.location, r.ok_count, r.nok_count, r.na_count, r.open_count].map(q).join(';'); })];
    EDP.download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), EDP.safeName(`VCA_inspections_${y}${proj ? '_' + proj : ''}.csv`));
  }

  $('#yearSel').onchange = loadData;
  $('#projSel').onchange = render;
  $('#refreshBtn').onclick = loadData;
  $('#csvBtn').onclick = csv;
  $('#pdfReportBtn').onclick = () => {
    try { const y = $('#yearSel').value, proj = $('#projSel').value; EDP.download(vcaPdf(), EDP.safeName(`VCA_report_${y}${proj ? '_' + proj : ''}.pdf`)); }
    catch (e) { console.error(e); toast(t('pdfFailed')); }
  };
  I18N.onChange(() => { if (me && me.role !== 'worker') render(); });
  EDP.initShell();
  EDPAuth.require().then(async p => {
    me = await EDPAuth.profile(true) || p;
    if (!me || (me.role !== 'supervisor' && me.role !== 'admin')) { $('#noAccess').classList.remove('hidden'); return; }
    $('#dash').classList.remove('hidden');
    $('#setLink').classList.toggle('hidden', me.role !== 'admin');
    loadData();
  });
})();
