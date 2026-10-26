/* EDP Reports - Commissioning Report and Site Safety Inspection */
(() => {
  'use strict';
  const { t, esc, today, uid, toast } = EDP;
  const $ = s => document.querySelector(s);

  const modules = {
    commissioning: {
      titleKey: 'tileCommTitle', eyebrowKey: 'commEyebrow', storage: 'enerdeal-v3-commissioning', file: 'Commissioning_Report',
      statuses: ['Pass', 'Fail', 'N/A'], bad: 'Fail',
      details: [['company', 'f_company', 'text'], ['project', 'f_project', 'text'], ['reportNo', 'f_reportNo', 'text'], ['client', 'f_client', 'text'], ['date', 'f_commDate', 'date'], ['site', 'f_site', 'text'], ['technician', 'f_technician', 'text'], ['address', 'f_address', 'text'], ['equipment', 'f_equipment', 'text']],
      completion: [['finalStatus', 'f_finalStatus', 'select'], ['signoff', 'f_signoff', 'text'], ['clientSignoff', 'f_clientSignoff', 'text']],
      sections: [['commSection', ['cq1', 'cq2', 'cq3', 'cq4', 'cq5', 'cq6', 'cq7', 'cq8', 'cq9', 'cq10']]]
    },
    safety: {
      titleKey: 'tileSafetyTitle', eyebrowKey: 'safetyEyebrow', storage: 'enerdeal-v3-safety', file: 'Site_Safety_Inspection',
      statuses: ['OK', 'NOK', 'N/A'], bad: 'NOK',
      details: [['company', 'f_company', 'text'], ['project', 'f_project', 'text'], ['date', 'f_date', 'date'], ['location', 'f_location', 'text'], ['inspector', 'f_inspector', 'text']],
      completion: [['positive', 'f_positive', 'textarea'], ['actions', 'f_actions', 'textarea'], ['signoff', 'f_inspSignoff', 'text']],
      sections: [
        ['ss1', ['sq1_1', 'sq1_2', 'sq1_3', 'sq1_4']], ['ss2', ['sq2_1', 'sq2_2', 'sq2_3', 'sq2_4']],
        ['ss3', ['sq3_1', 'sq3_2', 'sq3_3', 'sq3_4', 'sq3_5']], ['ss4', ['sq4_1', 'sq4_2', 'sq4_3']],
        ['ss5', ['sq5_1', 'sq5_2', 'sq5_3']], ['ss6', ['sq6_1', 'sq6_2', 'sq6_3', 'sq6_4']], ['ss7', ['sq7_1', 'sq7_2', 'sq7_3']]
      ]
    }
  };
  const FINAL = ['Passed', 'Passed with remarks', 'Failed'];

  let type = null, state = null, edit = false, logo = null, me = null;
  EDP.imageData('assets/edp-logo.jpg').then(d => { logo = d; });

  const qLabel = q => q.label || t(q.key);
  const qSection = q => q.sectionKey ? t(q.sectionKey) : (q.section || t('customQuestions'));

  function defaults(tp) {
    const m = modules[tp];
    const questions = m.sections.flatMap(([sectionKey, keys]) => keys.map(key => ({ id: uid(), key, sectionKey, photosEnabled: true })));
    const values = { company: 'EDP', date: today() };
    if (me && me.full_name) { if (tp === 'safety') values.inspector = me.full_name; else values.technician = me.full_name; }
    return { reportId: uid(), values, questions, answers: {}, generalNotes: '', generalPhotos: [] };
  }
  /* Older drafts stored English text; link them to translation keys so they follow the chosen language. */
  function migrate(s, tp) {
    s.values ??= {}; s.answers ??= {}; s.generalPhotos ??= []; s.reportId ??= uid();
    if (!Array.isArray(s.questions) || !s.questions.length) s.questions = defaults(tp).questions;
    const qp = tp === 'safety' ? 'sq' : 'cq';
    s.questions.forEach(q => {
      if (!q.key && q.label) { const k = I18N.keyFor(q.label, qp); if (k) { q.key = k; delete q.label; } }
      if (!q.sectionKey && q.section) {
        const k = q.section === 'Commissioning checklist' ? 'commSection' : q.section === 'Custom questions' ? 'customQuestions' : I18N.keyFor(q.section, 'ss');
        if (k) { q.sectionKey = k; delete q.section; }
      }
    });
    Object.values(s.answers).forEach(a => { a.photos ??= []; });
    return s;
  }
  function load(tp) {
    type = tp; edit = false;
    state = migrate(EDP.load(modules[tp].storage) || defaults(tp), tp);
    [...state.generalPhotos, ...Object.values(state.answers).flatMap(a => a.photos)].forEach(p => EDP.ensureJpeg(p.data));
    render(); window.scrollTo(0, 0);
  }
  const save = () => EDP.safeSave(modules[type].storage, state);

  function field([id, key, kind], host) {
    const l = document.createElement('label');
    l.append(t(key) + (id === 'project' ? ' *' : ''));
    let x;
    if (kind === 'select') {
      x = document.createElement('select');
      x.add(new Option(t('choose'), ''));
      FINAL.forEach(v => x.add(new Option(t('fs_' + v), v)));
    } else if (kind === 'textarea') { x = document.createElement('textarea'); x.rows = 3; }
    else { x = document.createElement('input'); x.type = kind; }
    x.value = state.values[id] || '';
    if (id === 'project') { x.required = true; x.id = 'projectField'; }
    x.oninput = x.onchange = () => { state.values[id] = x.value; save(); };
    l.appendChild(x); host.appendChild(l);
  }

  function render() {
    if (!type) return;
    const m = modules[type];
    $('#home').classList.add('hidden'); $('#report').classList.remove('hidden'); $('#actions').classList.remove('hidden'); $('#backBtn').classList.remove('hidden');
    $('#appTitle').textContent = t(m.titleKey); $('#moduleTitle').textContent = t(m.titleKey); $('#moduleEyebrow').textContent = t(m.eyebrowKey);
    $('#editBtn').textContent = edit ? t('done') : t('editChecklist');
    $('#addQuestionBtn').classList.toggle('hidden', !edit);
    const d = $('#detailFields'); d.innerHTML = ''; m.details.forEach(f => field(f, d));
    const c = $('#completionFields'); c.innerHTML = ''; m.completion.forEach(f => field(f, c));
    $('#generalNotes').value = state.generalNotes || '';
    renderQuestions();
    renderGeneralPhotos();
  }
  function renderGeneralPhotos() { renderPhotos(state.generalPhotos, $('#generalPhotoGrid'), () => { save(); renderGeneralPhotos(); }); }

  function renderQuestions() {
    const m = modules[type], host = $('#questionList');
    host.innerHTML = '';
    let sec = null;
    state.questions.forEach((q, i) => {
      const s = qSection(q);
      if (s !== sec) { sec = s; const h = document.createElement('h3'); h.textContent = s; host.appendChild(h); }
      const a = state.answers[q.id] ??= { status: '', remark: '', photos: [] };
      const box = document.createElement('div');
      box.className = 'question' + (a.status === m.bad ? ' nok' : '');
      box.innerHTML = `<div class="qtop"><strong>${esc(qLabel(q))}</strong><div class="qtools ${edit ? '' : 'hidden'}"><button type="button" data-rename title="${esc(t('rename'))}">✎</button><button type="button" data-photo title="${esc(t('togglePhotos'))}">${q.photosEnabled ? '📷' : '🚫'}</button><button type="button" data-delete title="${esc(t('del'))}">×</button></div></div>
        <div class="status">${m.statuses.map(v => `<button type="button" data-v="${v}" class="${a.status === v ? 'sel ' + (v === m.bad ? 'nok' : v === 'N/A' ? 'na' : 'ok') : ''}">${esc(t('st_' + v))}</button>`).join('')}</div>
        <textarea class="qremark" rows="2" placeholder="${esc(t('remarkPh'))}">${esc(a.remark)}</textarea>
        <label class="photoAdd ${q.photosEnabled ? '' : 'hidden'}"><span>${esc(t('addPhoto'))}</span><input type="file" accept="image/*" multiple></label>
        <div class="photos"></div>`;
      box.querySelectorAll('.status button').forEach(b => b.onclick = () => { a.status = a.status === b.dataset.v ? '' : b.dataset.v; save(); renderQuestions(); });
      box.querySelector('.qremark').oninput = e => { a.remark = e.target.value; save(); };
      box.querySelector('input[type=file]').onchange = async e => { a.photos.push(...(await EDP.readPhotos(e.target.files)).map(p => ({ data: p.data, caption: '' }))); e.target.value = ''; save(); renderQuestions(); };
      const ph = box.querySelector('.photos'), redraw = () => { save(); renderPhotos(a.photos, ph, redraw); };
      renderPhotos(a.photos, ph, redraw);
      box.querySelector('[data-rename]').onclick = () => { const x = prompt(t('questionName'), qLabel(q)); if (x !== null && x.trim()) { q.label = x.trim(); save(); renderQuestions(); } };
      box.querySelector('[data-photo]').onclick = () => { q.photosEnabled = !q.photosEnabled; save(); renderQuestions(); };
      box.querySelector('[data-delete]').onclick = () => { if (confirm(t('deleteQuestion'))) { state.questions.splice(i, 1); delete state.answers[q.id]; save(); renderQuestions(); } };
      host.appendChild(box);
    });
  }

  function renderPhotos(arr, host, changed) {
    host.innerHTML = '';
    arr.forEach((p, i) => {
      const x = document.createElement('div'); x.className = 'photo';
      x.innerHTML = `<img src="${p.data}" alt="${esc(t('photo'))} ${i + 1}"><button type="button" class="x" title="${esc(t('removePhoto'))}">×</button><input value="${esc(p.caption || '')}" placeholder="${esc(t('caption'))}">`;
      x.querySelector('.x').onclick = () => { arr.splice(i, 1); changed(); };
      x.querySelector('input').oninput = e => { p.caption = e.target.value; save(); };
      host.appendChild(x);
    });
  }

  function pdf() {
    const m = modules[type], title = t(m.titleKey), doc = new TinyPDF({ title });
    const C = { i: '#17212b', g: '#5f6c78', l: '#d9e1e7', r: '#b42318', ok: '#1f7a3d', a: '#14a9bb', n: '#272e3b' }, M = 15;
    let y = 0;
    const page = () => { EDP.pdfHeader(doc, title, logo); y = 34; };
    const ensure = h => { if (y + h > 278) { doc.addPage(); page(); } };
    const line = (k, v) => { const lines = doc.wrap(v || '—', 125, 9); ensure(Math.min(lines.length * 4 + 6, 60)); doc.text(k, M, y, 8, 'bold', C.g); lines.forEach(ln => { ensure(5); doc.text(ln, 68, y, 9, 'normal', C.i); y += 4; }); y += 4; };
    const img = (data, maxH = 62) => { const j = EDP.jpegSync(data); if (!j) return; ensure(maxH + 4); try { y += doc.addJpegFit(j, M, y, 180, maxH) + 4; } catch (e) {} };
    const val = (id, kind) => kind === 'select' && state.values[id] ? t('fs_' + state.values[id]) : state.values[id];
    page();
    m.details.forEach(([id, key, kind]) => line(t(key), val(id, kind)));
    let sec = null;
    state.questions.forEach(q => {
      const a = state.answers[q.id] || {};
      const s = qSection(q);
      if (s !== sec) { sec = s; ensure(18); y += 3; doc.text(s.toUpperCase(), M, y, 10.5, 'bold', C.n); y += 8; }
      const lbl = doc.wrap(qLabel(q), 140, 9);
      ensure(lbl.length * 4 + 8);
      doc.line(M, y - 4, 195, y - 4, C.l, .25);
      lbl.forEach((ln, k) => doc.text(ln, M, y + k * 4, 9, 'bold', C.i));
      doc.text(a.status ? t('st_' + a.status) : t('notChecked'), 195, y, 9, 'bold', a.status === m.bad ? C.r : a.status ? C.ok : C.g, 'right');
      y += Math.max(8, lbl.length * 4 + 4);
      if (a.remark) line(t('remarkAction'), a.remark);
      (a.photos || []).forEach(p => { img(p.data); if (p.caption) line(t('photo'), p.caption); });
    });
    if (state.generalNotes || state.generalPhotos.length) { ensure(18); y += 3; doc.text(t('generalNotes').toUpperCase(), M, y, 10.5, 'bold', C.n); y += 8; }
    if (state.generalNotes) line(t('generalNotes'), state.generalNotes);
    state.generalPhotos.forEach(p => { img(p.data); if (p.caption) line(t('photo'), p.caption); });
    ensure(18); y += 3; doc.text(t('completion').toUpperCase(), M, y, 10.5, 'bold', C.n); y += 8;
    m.completion.forEach(([id, key, kind]) => line(t(key), val(id, kind)));
    EDP.pdfFooter(doc);
    return doc.output();
  }
  const filename = () => EDP.safeName(`${modules[type].file}_${state.values.project || state.values.reportNo || state.values.site || today()}.pdf`);
  function checkProject() {
    if ((state.values.project || '').trim()) return true;
    toast(t('projectRequired'), 3500);
    const f = $('#projectField'); if (f) { f.classList.add('invalid'); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => f.focus(), 300); }
    return false;
  }
  /* Site Safety Inspections count for the VCA target: register them (queued when offline). */
  function register() {
    if (type !== 'safety') return;
    const m = modules[type], c = { OK: 0, NOK: 0, 'N/A': 0, '': 0 };
    state.questions.forEach(q => { c[(state.answers[q.id] || {}).status || ''] += 1; });
    EDPAuth.queueReport({ id: state.reportId, module: 'safety', project: state.values.project.trim(), location: state.values.location || null,
      report_date: state.values.date || today(), ok_count: c.OK, nok_count: c.NOK, na_count: c['N/A'], open_count: c[''], lang: I18N.lang })
      .then(r => { toast(r && r.pending ? t('registeredOffline') : t('registered')); renderUserCard(); });
  }
  function makePdf() {
    if (!checkProject()) return null;
    let b = null;
    try { b = pdf(); } catch (e) { console.error(e); toast(t('pdfFailed')); return null; }
    register(); return b;
  }

  /* Home: who is signed in + own VCA progress */
  async function renderUserCard() {
    const card = $('#userCard'); if (!me) return;
    const y = new Date().getFullYear(), target = EDPAuth.CONFIG.target;
    let n = null;
    try {
      const rows = await EDPAuth.rest(`reports?select=id&module=eq.safety&user_id=eq.${me.id}&report_date=gte.${y}-01-01&report_date=lte.${y}-12-31`);
      n = rows.length; try { localStorage.setItem('edp-vca-count', JSON.stringify({ y, n })); } catch (e) {}
    } catch (e) { try { const c = JSON.parse(localStorage.getItem('edp-vca-count')); if (c && c.y === y) n = c.n; } catch (x) {} }
    const pend = EDPAuth.pending(), total = (n || 0) + pend, pct = Math.min(100, Math.round(total / target * 100));
    card.innerHTML = `<div class="user-row"><span>${esc(t('signedInAs', { n: me.full_name || me.email }))}</span><button type="button" class="secondary compact" id="signOutBtn">${esc(t('signOut'))}</button></div>
      <div class="vca"><div class="vca-head"><strong>${esc(t('myVca', { y }))}</strong><span>${esc(t('vcaOf', { n: n == null ? '…' : total, t: target }))}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <small class="muted">${esc(total >= target ? t('vcaDone') : t('vcaToGo', { n: target - total }))}${pend ? ' · ' + esc(t('syncPending', { n: pend })) : ''}</small></div>`;
    card.classList.remove('hidden');
    $('#signOutBtn').onclick = async () => { if (confirm(t('confirmSignOut'))) { await EDPAuth.signOut(); location.reload(); } };
    $('#dashTile').classList.toggle('hidden', !(me.role === 'supervisor' || me.role === 'admin'));
    $('#setTile').classList.toggle('hidden', me.role !== 'admin');
  }

  /* Events */
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => load(b.dataset.open));
  $('#backBtn').onclick = () => {
    if (type) save();
    type = null;
    $('#home').classList.remove('hidden'); $('#report').classList.add('hidden'); $('#actions').classList.add('hidden'); $('#backBtn').classList.add('hidden');
    $('#appTitle').textContent = t('appName'); window.scrollTo(0, 0);
  };
  $('#editBtn').onclick = () => { edit = !edit; $('#addQuestionBtn').classList.toggle('hidden', !edit); $('#editBtn').textContent = edit ? t('done') : t('editChecklist'); renderQuestions(); };
  $('#addQuestionBtn').onclick = () => { const label = prompt(t('questionName'), t('newQuestion')); if (label && label.trim()) { state.questions.push({ id: uid(), sectionKey: 'customQuestions', label: label.trim(), photosEnabled: true }); save(); renderQuestions(); } };
  $('#generalNotes').oninput = e => { state.generalNotes = e.target.value; save(); };
  $('#generalPhotos').onchange = async e => { state.generalPhotos.push(...(await EDP.readPhotos(e.target.files)).map(p => ({ data: p.data, caption: '' }))); e.target.value = ''; save(); render(); };
  $('#newBtn').onclick = () => { if (confirm(t('confirmNew'))) { const qs = structuredClone(state.questions); state = defaults(type); state.questions = qs; save(); render(); } };
  $('#downloadBtn').onclick = () => { const b = makePdf(); if (b) EDP.download(b, filename()); };
  $('#shareBtn').onclick = () => { const b = makePdf(); if (b) EDP.deliver(b, filename(), t(modules[type].titleKey)).catch(e => { if (e && e.name !== 'AbortError') EDP.download(b, filename()); else toast(t('sharingCancelled')); }); };

  I18N.onChange(() => { if (type) render(); else $('#appTitle').textContent = t('appName'); renderUserCard(); });
  EDP.initShell();
  EDPAuth.require().then(p => { me = p; renderUserCard(); });
  window.addEventListener('online', () => EDPAuth.flush().then(renderUserCard));
})();
