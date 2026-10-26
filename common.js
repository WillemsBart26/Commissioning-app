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
  function initShell() {
    const sw = document.getElementById('langSwitch'); if (sw) global.I18N.mountSwitch(sw);
    let deferred = null;
    const btn = document.getElementById('installBtn');
    global.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
    if (btn) btn.onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; } else toast(t('installHelp'), 4000); };
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
    global.I18N.apply();
  }

  global.EDP = { t, esc, today, uid, toast, safeSave, load, compressPhoto, readPhotos, ensureJpeg, jpegSync, imageData, pdfHeader, pdfFooter, deliver, download, safeName, initShell, VERSION: '4.1' };
})(window);
