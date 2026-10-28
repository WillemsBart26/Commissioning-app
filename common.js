/* EDP Reports - shared helpers for all report modules */
(function (global) {
  'use strict';
  const t = (k, v) => global.I18N.t(k, v);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2);

  let toastTimer;
  function toast(msg, ms = 2400) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /* Save JSON to localStorage; warns clearly when the phone storage is full instead of failing silently. */
  function safeSave(key, obj) {
    const status = document.getElementById('saveStatus');
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      if (status) { status.textContent = t('saved'); status.classList.remove('error'); }
      return true;
    } catch (e) {
      if (status) { status.textContent = t('storageFull'); status.classList.add('error'); }
      toast(t('storageFull'), 5000);
      return false;
    }
  }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }

  /* Read any image (JPEG, PNG, HEIC where the browser supports it), shrink it and return a JPEG data URL. */
  function compressPhoto(file, max = 1280, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('read'));
      r.onload = () => {
        const im = new Image();
        im.onerror = () => reject(new Error('decode'));
        im.onload = () => {
          const s = Math.min(1, max / Math.max(im.width, im.height));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s));
          const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          cx.drawImage(im, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', quality));
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  /* Convert files to compressed photos; reports failures instead of hiding them. */
  async function readPhotos(files) {
    const out = [];
    for (const f of [...(files || [])]) {
      try { out.push({ data: await compressPhoto(f), name: f.name.replace(/\.[^.]+$/, '') }); }
      catch (e) { toast(t('photoFailed') + ': ' + f.name, 4000); }
    }
    if (out.length) toast(out.length === 1 ? t('photoAdded') : t('photosAdded', { n: out.length }));
    return out;
  }
  /* Make sure an existing data URL (e.g. an old PNG photo) is JPEG, so it fits in the PDF. */
  const jpegCache = new Map();
  function ensureJpeg(dataUrl) {
    if (!dataUrl) return Promise.resolve(null);
    if (/^data:image\/jpe?g/i.test(dataUrl)) return Promise.resolve(dataUrl);
    if (jpegCache.has(dataUrl)) return Promise.resolve(jpegCache.get(dataUrl));
    return new Promise(res => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0);
        const j = cv.toDataURL('image/jpeg', 0.85); jpegCache.set(dataUrl, j); res(j);
      };
      im.onerror = () => res(null);
      im.src = dataUrl;
    });
  }
  /* Synchronous lookup (PDF is built synchronously so phone sharing keeps working). */
  function jpegSync(d) { if (!d) return null; return /^data:image\/jpe?g/i.test(d) ? d : (jpegCache.get(d) || null); }
  /* Fetch a file from the app (works offline through the service worker) as a JPEG data URL. */
  const urlCache = new Map();
  async function imageData(url) {
    if (urlCache.has(url)) return urlCache.get(url);
    try {
      const b = await (await fetch(url)).blob();
      const d = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
      const j = await ensureJpeg(d); urlCache.set(url, j); return j;
    } catch (e) { return null; }
  }

  /* Common PDF page header: dark EDP band with the logo and the report title. */
  function pdfHeader(doc, title, logo) {
    doc.rect(0, 0, 210, 24, '#272e3b');
    if (logo) { try { doc.addJpegFit(logo, 8, 3, 34, 18, 'left'); } catch (e) {} }
    doc.text(title.toUpperCase(), 52, 14.5, 12, 'bold', '#ffffff');
  }
  function pdfFooter(doc) { doc.addFooters('EDP', (i, n) => t('page', { i, n })); }

  function deliver(blob, filename, title) {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      return navigator.share({ title, files: [file] });
    }
    download(blob, filename); return Promise.resolve();
  }
  function download(blob, filename) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1500);
  }
  const safeName = s => String(s).replace(/[^a-z0-9_.-]+/gi, '_');

  /* Header: language switch + install button + service worker */
  /* Install instructions for Android and iPhone (with a direct install button where the browser supports it) */
  function showInstallHelp(getPrompt, clearPrompt) {
    let m = document.getElementById('installModal');
    if (m) m.remove();
    const steps = (keys) => `<ol>${keys.map(k => `<li>${esc(t(k))}</li>`).join('')}</ol>`;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent), canPrompt = !!(getPrompt && getPrompt());
    m = document.createElement('div'); m.id = 'installModal'; m.className = 'modal';
    m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><h2>${esc(t('instTitle'))}</h2><p class="muted">${esc(t('instIntro'))}</p>
      ${canPrompt ? `<button type="button" class="primary full" id="instNow">${esc(t('instNow'))}</button>` : ''}
      ${(() => { const a = `<div class="inst"><h3>🤖 ${esc(t('instAndroid'))}</h3>${steps(['instA1', 'instA2', 'instA3', 'instA4'])}</div>`, i = `<div class="inst"><h3>📱 ${esc(t('instIphone'))}</h3>${steps(['instI1', 'instI2', 'instI3', 'instI4'])}</div>`; return isIos ? i + a : a + i; })()}
      <button type="button" class="secondary full" id="instClose">${esc(t('instClose'))}</button></div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.onclick = e => { if (e.target === m) close(); };
    m.querySelector('#instClose').onclick = close;
    const now = m.querySelector('#instNow');
    if (now) now.onclick = async () => { const p = getPrompt(); if (p) { p.prompt(); await p.userChoice; clearPrompt(); } close(); };
  }

  /* ---------- Updates ----------
     On every start (and when the app comes back to the front) the app asks the server which version is current.
     Newer version -> banner "New version available – Update". After updating -> one-time "What's new" notice. */
  const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  const pickNotes = n => (n && (n[global.I18N.lang] || n.en)) || [];
  function banner(html, cls) {
    let b = document.getElementById('updateBanner'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'updateBanner'; b.className = 'update-banner ' + (cls || ''); b.innerHTML = html;
    document.body.appendChild(b); return b;
  }
  async function checkForUpdate() {
    if (!navigator.onLine || document.body.classList.contains('gated')) return;
    try {
      const v = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json();
      if (cmpVer(v.version, VERSION) > 0) {
        const notes = pickNotes(v.notes);
        const b = banner(`<div><strong>${esc(t('updAvailable', { v: v.version }))}</strong>${notes.length ? `<ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div><div class="update-actions"><button type="button" class="primary" id="updNow">${esc(t('updNow'))}</button><button type="button" class="secondary" id="updLater">${esc(t('updLater'))}</button></div>`);
        b.querySelector('#updLater').onclick = () => b.remove();
        b.querySelector('#updNow').onclick = () => applyUpdate(b);
      }
    } catch (e) {}
  }
  async function applyUpdate(b) {
    b.querySelector('#updNow').disabled = true; b.querySelector('#updNow').textContent = t('updBusy');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        await new Promise(res => { const done = () => res(); navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }); setTimeout(done, 6000); });
      }
    } catch (e) {}
    location.reload();
  }
  function showWhatsNew() {
    let seen = null; try { seen = localStorage.getItem('edp-seen-version'); localStorage.setItem('edp-seen-version', VERSION); } catch (e) { return; }
    if (!seen || seen === VERSION) return; /* first install: nothing to announce */
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).catch(() => null).then(v => {
      const notes = v && v.version === VERSION ? pickNotes(v.notes) : [];
      const b = banner(`<div><strong>${esc(t('updDone', { v: VERSION }))}</strong>${notes.length ? `<ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div><div class="update-actions"><button type="button" class="primary" id="updOk">OK</button></div>`, 'done');
      b.querySelector('#updOk').onclick = () => b.remove();
    });
  }
  function initUpdates() {
    showWhatsNew();
    setTimeout(checkForUpdate, 1500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
    global.addEventListener('online', checkForUpdate);
  }

  /* Two photo buttons: take a photo with the camera, or pick existing photos from the gallery */
  function photoPicker(cls = '', galCls = '') {
    return `<div class="photo-pick ${cls}"><label class="photoAdd"><span>${esc(t('photoTake'))}</span><input type="file" accept="image/*" capture="environment" class="cam-in"></label>` +
      `<label class="photoAdd"><span>${esc(t('photoGallery'))}</span><input type="file" accept="image/*" multiple class="gal-in ${galCls}"></label></div>`;
  }
  function bindPicker(root, handler) {
    root.querySelectorAll('.photo-pick input[type=file]').forEach(inp => inp.onchange = async e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) await handler(f); });
  }

  function initShell() {
    const sw = document.getElementById('langSwitch'); if (sw) global.I18N.mountSwitch(sw);
    let deferred = null;
    const btn = document.getElementById('installBtn');
    global.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
    if (btn) btn.onclick = () => showInstallHelp(() => deferred, () => { deferred = null; });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
    initUpdates();
    global.I18N.apply();
  }

  const VERSION = '4.8';
  global.EDP = { t, esc, today, uid, toast, safeSave, load, compressPhoto, readPhotos, ensureJpeg, jpegSync, imageData, pdfHeader, pdfFooter, deliver, download, safeName, initShell, showInstallHelp, photoPicker, bindPicker, checkForUpdate, VERSION };
})(window);
