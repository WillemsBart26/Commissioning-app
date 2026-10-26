/* EDP Reports - SPAQUE Inspection Report */
(() => {
  'use strict';
  const { t, esc, today, uid, toast } = EDP;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'cr22';

  const FIELDS = [['project', 'sp_project', 'text'], ['address', 'sp_address', 'text'], ['date', 'sp_date', 'date'], ['inspector', 'sp_inspector', 'text'], ['zone', 'sp_zone', 'text'], ['foundation', 'sp_foundation', 'text'], ['power', 'sp_power', 'text'], ['modules', 'sp_modules', 'text'], ['tilt', 'sp_tilt', 'text'], ['azimuth', 'sp_azimuth', 'text']];
  const GROUPS = [
    { id: 'g1', n: 1, parts: [2, 14, 15, 16], image: 'assets/ref-1.jpg' },
    { id: 'g2', n: 2, parts: [7, 8, 9, 11, 12, 13], image: 'assets/ref-2.jpg' },
    { id: 'g3', n: 3, parts: [10, 17, 18], image: 'assets/ref-3.jpg' },
    { id: 'g4', n: 4, parts: [1, 3, 4, 5, 6], image: 'assets/ref-4.jpg' }
  ];
  const BASE = [['cs1', 2], ['cs2', 16], ['cs3', 7], ['cs4', 5], ['cs5', 2], ['cs6', 1]]; /* section key, number of rows */
  const groupTitle = g => t('spRefPhoto', { n: g.n });
  const partName = n => t('p' + n);

  /* ---------- State ---------- */
  const state = EDP.load(KEY) || {};
  state.groupPhotos ??= {}; state.checks ??= []; state.extra ??= [];
  GROUPS.forEach(g => state.groupPhotos[g.id] ??= []);
  if (!state.date) state.date = today();
  function seed() {
    let id = 1; const out = [];
    BASE.forEach(([sec, n], si) => { for (let i = 1; i <= n; i++) out.push({ id: id++, key: `c${si + 1}_${i}`, sectionKey: sec, status: '', note: '', photos: [] }); });
    return out;
  }
  if (!state.checks.length) state.checks = seed();
  /* Migrate older drafts: English text -> translation key, single photo -> photo list */
  state.checks.forEach(o => {
    if (!o.key && o.text) { const k = I18N.keyFor(o.text, /^c\d_\d+$/); if (k) { o.key = k; delete o.text; } }
    if (!o.sectionKey && o.section) { const k = I18N.keyFor(o.section, /^cs\d$/) || (o.section === 'Custom' ? 'spCustom' : null); if (k) { o.sectionKey = k; delete o.section; } }
    o.photos ??= []; if (o.photo) { o.photos.push({ data: o.photo }); delete o.photo; }
  });
  const checkText = o => o.text || t(o.key);
  const checkSection = o => o.sectionKey ? t(o.sectionKey) : (o.section || t('spCustom'));
  const save = () => EDP.safeSave(KEY, state);

  /* Convert any older uncompressed/PNG photos so they appear in the PDF */
  const allPhotos = () => [...GROUPS.flatMap(g => state.groupPhotos[g.id].map(p => p.photo)), ...state.checks.flatMap(o => o.photos.map(p => p.data)), ...state.extra.map(p => p.photo)];
  allPhotos().forEach(d => EDP.ensureJpeg(d));
  let logo = null; const refs = {};
  EDP.imageData('assets/edp-logo.jpg').then(d => { logo = d; });
  GROUPS.forEach(g => EDP.imageData(g.image).then(d => { refs[g.id] = d; }));

  /* ---------- Info ---------- */
  function renderInfo() {
    $('#infoFields').innerHTML = FIELDS.map(([id, key, kind]) => `<label>${esc(t(key))}${id === 'project' ? ' *' : ''}<input type="${kind}" data-save="${id}" ${id === 'project' ? 'id="projectField" required' : ''} value="${esc(state[id] || '')}"></label>`).join('');
    $$('#infoFields [data-save]').forEach(el => el.oninput = el.onchange = () => { state[el.dataset.save] = el.value; save(); });
    $('#observations').value = state.observations || '';
  }
  $('#observations').oninput = e => { state.observations = e.target.value; save(); };

  /* ---------- Tabs ---------- */
  $$('.tab').forEach(b => b.onclick = () => {
    $$('.tab,.panel').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); $('#' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'photos') renderOverview();
    window.scrollTo(0, 0);
  });

  /* ---------- Parts ---------- */
  function renderParts() {
    $('#partGroups').innerHTML = GROUPS.map(g => {
      const photos = state.groupPhotos[g.id];
      return `<section class="assembly-group" data-group="${g.id}"><h3>${esc(groupTitle(g))}</h3>
        <img class="assembly-ref" src="${g.image}" alt="${esc(groupTitle(g))}">
        <ul class="parts-summary">${g.parts.map(n => `<li><strong>${n}</strong> · ${esc(partName(n))}</li>`).join('')}</ul>
        <div class="group-count">${esc(t('spPhotoCount', { n: photos.length }))}</div>
        <label class="photoAdd"><span>${esc(t('spAddPhotos'))}</span><input class="group-input" type="file" accept="image/*" multiple></label>
        <div class="photos">${photos.map((p, i) => `<div class="photo" data-index="${i}"><img src="${p.photo}" alt="${esc(t('spSitePhoto', { n: i + 1 }))}"><button type="button" class="x" title="${esc(t('removePhoto'))}">×</button><textarea rows="2" placeholder="${esc(t('spPhotoNote', { n: i + 1 }))}">${esc(p.note)}</textarea></div>`).join('')}</div></section>`;
    }).join('');
    $$('#partGroups .assembly-group').forEach(sec => {
      const photos = state.groupPhotos[sec.dataset.group];
      sec.querySelector('.group-input').onchange = async e => { photos.push(...(await EDP.readPhotos(e.target.files)).map(p => ({ photo: p.data, note: '' }))); save(); renderParts(); };
      sec.querySelectorAll('.photo').forEach(card => {
        const i = Number(card.dataset.index);
        card.querySelector('textarea').oninput = e => { photos[i].note = e.target.value; save(); };
        card.querySelector('.x').onclick = () => { photos.splice(i, 1); save(); renderParts(); };
      });
    });
  }

  /* ---------- Checklist ---------- */
  let editMode = false;
  function renderChecks() {
    let cur = null, h = '';
    state.checks.forEach(o => {
      const s = checkSection(o);
      if (s !== cur) { cur = s; h += `<h3>${esc(s)}</h3>`; }
      h += `<div class="check ${o.status === 'NOK' ? 'nok' : ''}" data-id="${o.id}">
        <div class="rowtop"><span class="title editable" contenteditable="${editMode}">${esc(checkText(o))}</span>${editMode ? `<div class="qtools">${o.text && o.key ? `<button type="button" class="reset" title="${esc(t('resetText'))}">↺</button>` : ''}<button type="button" class="del" title="${esc(t('del'))}">×</button></div>` : ''}</div>
        <div class="status">${['OK', 'NOK', 'N/A'].map(v => `<button type="button" data-v="${v}" class="${o.status === v ? 'sel ' + (v === 'OK' ? 'ok' : v === 'NOK' ? 'nok' : 'na') : ''}">${esc(t('st_' + v))}</button>`).join('')}</div>
        <textarea rows="2" placeholder="${esc(t('spRemark'))}">${esc(o.note)}</textarea>
        <label class="photoAdd"><span>${esc(t('addPhoto'))}</span><input type="file" accept="image/*" multiple></label>
        <div class="photos">${o.photos.map((p, i) => `<div class="photo" data-index="${i}"><img src="${p.data}" alt=""><button type="button" class="x" title="${esc(t('removePhoto'))}">×</button></div>`).join('')}</div></div>`;
    });
    $('#checkList').innerHTML = h;
    $$('#checkList .check').forEach(c => {
      const o = state.checks.find(x => String(x.id) === c.dataset.id);
      c.querySelectorAll('.status button').forEach(b => b.onclick = () => { o.status = o.status === b.dataset.v ? '' : b.dataset.v; save(); renderChecks(); });
      c.querySelector('textarea').oninput = e => { o.note = e.target.value; save(); };
      const ed = c.querySelector('.editable');
      ed.oninput = () => { const v = ed.innerText.trim(); if (v && v !== t(o.key)) o.text = v; else delete o.text; save(); };
      c.querySelector('input[type=file]').onchange = async e => { o.photos.push(...(await EDP.readPhotos(e.target.files)).map(p => ({ data: p.data }))); save(); renderChecks(); };
      c.querySelectorAll('.photo').forEach(p => p.querySelector('.x').onclick = () => { o.photos.splice(Number(p.dataset.index), 1); save(); renderChecks(); });
      const r = c.querySelector('.reset'); if (r) r.onclick = () => { delete o.text; save(); renderChecks(); };
      const d = c.querySelector('.del'); if (d) d.onclick = () => { if (confirm(t('deleteQuestion'))) { state.checks = state.checks.filter(x => x !== o); save(); renderChecks(); } };
    });
  }
  $('#editToggle').onclick = () => { editMode = !editMode; $('#editToggle').textContent = editMode ? t('done') : t('spEditFields'); renderChecks(); };
  $('#addCheck').onclick = () => {
    const sec = prompt(t('spNewSection'), t('spCustom')); if (sec === null) return;
    const text = prompt(t('spNewRowName'), t('spNewRowDefault'));
    if (text && text.trim()) {
      const known = I18N.keyFor(sec.trim(), /^cs\d$/);
      state.checks.push({ id: Date.now(), text: text.trim(), ...(known ? { sectionKey: known } : sec.trim() && sec.trim() !== t('spCustom') ? { section: sec.trim() } : { sectionKey: 'spCustom' }), status: '', note: '', photos: [] });
      save(); renderChecks();
    }
  };

  /* ---------- Photo overview ---------- */
  function overviewItems() {
    const arr = [];
    GROUPS.forEach(g => state.groupPhotos[g.id].forEach(o => arr.push({ label: `${groupTitle(g)} · ${g.parts.join(', ')}`, photo: o.photo, obj: o, field: 'note' })));
    state.checks.forEach(o => o.photos.forEach(p => arr.push({ label: checkText(o), photo: p.data, obj: p, field: 'caption' })));
    state.extra.forEach(o => arr.push({ label: t('spExtraLabel'), photo: o.photo, obj: o, field: 'note', extra: true }));
    return arr;
  }
  function renderOverview() {
    const arr = overviewItems();
    $('#photoOverview').innerHTML = arr.length ? arr.map((x, i) => `<div class="photoCard" data-i="${i}"><img src="${x.photo}" alt=""><strong>${esc(x.label)}</strong><textarea rows="2" placeholder="${esc(t('spPhotoDesc'))}">${esc(x.obj[x.field])}</textarea>${x.extra ? `<button type="button" class="btn danger compact del">${esc(t('del'))}</button>` : ''}</div>`).join('') : `<p class="muted">${esc(t('spNoPhotos'))}</p>`;
    $$('#photoOverview .photoCard').forEach(c => {
      const x = arr[Number(c.dataset.i)];
      c.querySelector('textarea').oninput = e => { x.obj[x.field] = e.target.value; save(); };
      const d = c.querySelector('.del'); if (d) d.onclick = () => { state.extra = state.extra.filter(o => o !== x.obj); save(); renderOverview(); };
    });
  }
  $('#extraPhoto').onchange = async e => { state.extra.push(...(await EDP.readPhotos(e.target.files)).map(p => ({ id: uid(), photo: p.data, note: '' }))); e.target.value = ''; save(); renderOverview(); };

  /* ---------- PDF ---------- */
  function pdfBlob() {
    const title = t('tileSpaqueTitle'), doc = new TinyPDF({ title });
    const C = { n: '#272e3b', a: '#14a9bb', i: '#17212b', g: '#5f6c78', l: '#d9e1e7', r: '#b42318', ok: '#1f7a3d' }, M = 15;
    let y = 0;
    const page = () => { EDP.pdfHeader(doc, title, logo); y = 34; };
    const ensure = h => { if (y + h > 278) { doc.addPage(); page(); } };
    const line = (k, v) => { const lines = doc.wrap(v || '—', 125, 9); ensure(Math.min(lines.length * 4 + 6, 60)); doc.text(k, M, y, 8, 'bold', C.g); lines.forEach(ln => { ensure(5); doc.text(ln, 68, y, 9, 'normal', C.i); y += 4; }); y += 4; };
    const heading = s => { ensure(18); y += 3; doc.text(s, M, y, 11, 'bold', C.n); y += 9; };
    const img = (data, maxH = 62) => { const j = EDP.jpegSync(data); if (!j) return; ensure(maxH + 4); try { y += doc.addJpegFit(j, M, y, 180, maxH) + 4; } catch (e) {} };
    page();
    doc.text('ISO 2859-1 · General Level II sampling', M, y, 8.5, 'normal', C.g); y += 8;
    FIELDS.forEach(([id, key]) => line(t(key), state[id]));
    heading(t('pdfParts'));
    GROUPS.forEach(g => {
      ensure(30); doc.text(groupTitle(g), M, y, 10, 'bold', C.a); y += 6;
      if (refs[g.id]) img(refs[g.id], 70);
      g.parts.forEach(n => line(String(n), partName(n)));
      state.groupPhotos[g.id].forEach((o, i) => { ensure(12); doc.text(t('spSitePhoto', { n: i + 1 }), M, y, 8, 'bold', C.g); y += 5; img(o.photo); if (o.note) line(t('pdfPhotoRemark'), o.note); });
      y += 3;
    });
    heading(t('pdfChecklist'));
    let sec = null;
    state.checks.forEach(o => {
      const s = checkSection(o);
      if (s !== sec) { sec = s; ensure(28); doc.text(s, M, y, 10, 'bold', C.a); y += 7; }
      const lbl = doc.wrap(checkText(o), 140, 9);
      ensure(lbl.length * 4 + 8);
      doc.line(M, y - 4, 195, y - 4, C.l, .25);
      lbl.forEach((ln, k) => doc.text(ln, M, y + k * 4, 9, 'bold', C.i));
      doc.text(o.status ? t('st_' + o.status) : t('notChecked'), 195, y, 9, 'bold', o.status === 'NOK' ? C.r : o.status ? C.ok : C.g, 'right');
      y += Math.max(8, lbl.length * 4 + 4);
      if (o.note) line(t('spRemark'), o.note);
      o.photos.forEach(p => { img(p.data); if (p.caption) line(t('photo'), p.caption); });
    });
    if (state.observations) { heading(t('pdfObservations')); line(t('spObservations'), state.observations); }
    if (state.extra.length) {
      heading(t('pdfPhotoOverview'));
      state.extra.forEach(o => { ensure(12); doc.text(t('spExtraLabel'), M, y, 8, 'bold', C.g); y += 5; img(o.photo); if (o.note) line(t('pdfPhotoRemark'), o.note); });
    }
    EDP.pdfFooter(doc);
    return doc.output();
  }
  const pdfName = () => EDP.safeName(`SPAQUE_Inspection_${state.project || state.date || today()}.pdf`);
  function makePdf() {
    if (!(state.project || '').trim()) {
      toast(t('projectRequired'), 3500);
      $$('.tab,.panel').forEach(x => x.classList.remove('active')); $('[data-tab=info]').classList.add('active'); $('#info').classList.add('active');
      const f = $('#projectField'); if (f) { f.classList.add('invalid'); f.focus(); }
      return null;
    }
    try { return pdfBlob(); } catch (e) { console.error(e); toast(t('pdfFailed')); return null; }
  }
  $('#pdfBtn').onclick = () => { const b = makePdf(); if (b) EDP.download(b, pdfName()); };
  $('#shareBtn').onclick = () => { const b = makePdf(); if (b) EDP.deliver(b, pdfName(), t('tileSpaqueTitle')).catch(e => { if (e && e.name !== 'AbortError') EDP.download(b, pdfName()); else toast(t('sharingCancelled')); }); };
  $('#resetBtn').onclick = () => {
    if (!confirm(t('spConfirmNew'))) return;
    FIELDS.forEach(([id]) => delete state[id]); delete state.observations;
    state.date = today(); GROUPS.forEach(g => state.groupPhotos[g.id] = []); state.extra = [];
    state.checks.forEach(o => { o.status = ''; o.note = ''; o.photos = []; });
    save(); renderAll();
  };

  function renderAll() { renderInfo(); renderParts(); renderChecks(); renderOverview(); $('#editToggle').textContent = editMode ? t('done') : t('spEditFields'); }
  I18N.onChange(renderAll);
  renderAll();
  EDP.initShell();
  EDPAuth.require().then(p => { if (p && p.full_name && !state.inspector) { state.inspector = p.full_name; save(); renderInfo(); } });
})();
