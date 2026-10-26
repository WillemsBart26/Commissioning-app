/* EDP Reports - VCA overview for supervisors and the administrator */
(() => {
  'use strict';
  const { t, esc, toast } = EDP;
  const $ = s => document.querySelector(s);
  const TARGET = EDPAuth.CONFIG.target;
  let me = null, profiles = [], reports = [];

  const now = new Date(), thisYear = now.getFullYear();
  $('#yearSel').innerHTML = [thisYear, thisYear - 1, thisYear - 2].map(y => `<option>${y}</option>`).join('');

  /* How many inspections someone should have by today to stay on track (12 per year = 1 per month). */
  function expectedBy(year) {
    if (year < thisYear) return TARGET;
    if (year > thisYear) return 0;
    return Math.floor(TARGET * (now.getMonth() + 1) / 12);
  }
  function statusPill(n, year) {
    if (n >= TARGET) return `<span class="pill ok">${esc(t('dashReached'))}</span>`;
    return n >= expectedBy(year) ? `<span class="pill track">${esc(t('dashOnTrack'))}</span>` : `<span class="pill behind">${esc(t('dashBehind'))}</span>`;
  }
  const nameOf = id => { const p = profiles.find(x => x.id === id); return p ? (p.full_name || p.email) : '?'; };

  async function loadData() {
    const y = Number($('#yearSel').value);
    $('#saveStatus').textContent = '…';
    try {
      [profiles, reports] = await Promise.all([
        EDPAuth.rest('profiles?select=id,email,full_name,role&order=full_name'),
        EDPAuth.rest(`reports?select=id,user_id,project,location,report_date,ok_count,nok_count,na_count,open_count&module=eq.safety&report_date=gte.${y}-01-01&report_date=lte.${y}-12-31&order=report_date.desc`)
      ]);
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

    /* Per person: everyone with an account, also those with 0 inspections */
    const per = profiles.map(p => ({ p, n: rows.filter(r => r.user_id === p.id).length }))
      .sort((a, b) => a.n - b.n || (a.p.full_name || a.p.email).localeCompare(b.p.full_name || b.p.email));
    $('#tPeople').innerHTML = `<thead><tr><th>${esc(t('dashPerson'))}</th><th>${esc(t('dashProgress'))}</th><th>${esc(t('dashRole'))}</th></tr></thead><tbody>` +
      (per.length ? per.map(({ p, n }) => `<tr><td><strong>${esc(p.full_name || '—')}</strong><br><small class="muted">${esc(p.email)}</small></td>
        <td class="prog"><div class="prog-top"><strong>${n} / ${TARGET}</strong>${statusPill(n, y)}</div><div class="mini-bar"><span class="${n >= TARGET ? 'done' : ''}" style="width:${Math.min(100, Math.round(n / TARGET * 100))}%"></span></div></td>
        <td>${esc(t('role_' + p.role))}</td></tr>`).join('')
        : `<tr><td colspan="3" class="muted">${esc(t('dashNone'))}</td></tr>`) + '</tbody>';

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

    $('#kTotal').textContent = rows.length;
    $('#kReached').textContent = `${per.filter(x => x.n >= TARGET).length} / ${per.length}`;
    $('#kProjects').textContent = projRows.length;
  }

  function csv() {
    const y = $('#yearSel').value, proj = $('#projSel').value;
    const rows = proj ? reports.filter(r => r.project.trim() === proj) : reports;
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = [t('dashDate'), t('dashPerson'), 'E-mail', t('dashProject'), t('dashLocation'), 'OK', 'NOK', 'N/A', t('notChecked')];
    const lines = [head.map(q).join(';'), ...rows.map(r => { const p = profiles.find(x => x.id === r.user_id) || {}; return [r.report_date, p.full_name, p.email, r.project, r.location, r.ok_count, r.nok_count, r.na_count, r.open_count].map(q).join(';'); })];
    EDP.download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), EDP.safeName(`VCA_inspections_${y}${proj ? '_' + proj : ''}.csv`));
  }

  $('#yearSel').onchange = loadData;
  $('#projSel').onchange = render;
  $('#refreshBtn').onclick = loadData;
  $('#csvBtn').onclick = csv;
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
