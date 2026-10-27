/* EDP Reports - login (Supabase Auth) and report registration for the VCA overview.
   Uses plain fetch so it keeps working offline after the first login. */
(function (global) {
  'use strict';
  const CONFIG = {
    url: 'https://eycbivzjzxwzmawrcmgj.supabase.co',
    key: 'sb_publishable_ACwUl6OLobXO0sV_6pdyKg_TTsBXfKA',
    domain: '@edp.com',
    target: 12 /* VCA: inspections per person per year */
  };
  const t = (k, v) => global.I18N.t(k, v);
  const SKEY = 'edp-session', PKEY = 'edp-profile', QKEY = 'edp-sync-queue';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  /* "Stay signed in": session kept in localStorage (survives closing the app) or sessionStorage (until the app is closed) */
  const remember = () => { try { return localStorage.getItem('edp-remember') !== '0'; } catch (e) { return true; } };
  const readSession = () => { try { return JSON.parse(localStorage.getItem(SKEY) || sessionStorage.getItem(SKEY)); } catch (e) { return null; } };
  const writeSession = v => {
    try {
      localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY);
      if (v != null) (remember() ? localStorage : sessionStorage).setItem(SKEY, JSON.stringify(v));
    } catch (e) {}
  };
  const lastEmail = () => { try { return localStorage.getItem('edp-last-email') || ''; } catch (e) { return ''; } };

  async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
    const res = await fetch(CONFIG.url + path, {
      method,
      headers: { apikey: CONFIG.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) { const err = new Error((data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status)); err.status = res.status; err.code = data && (data.error_code || data.code); throw err; }
    return data;
  }
  function storeSession(d) {
    if (!d || !d.access_token) return null;
    const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600), user: d.user || (readSession() || {}).user };
    writeSession(s); return s;
  }
  /* Returns a valid session; refreshes when expired. Offline: keeps the stored session so field work continues. */
  async function session() {
    const s = readSession(); if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s;
    if (!navigator.onLine) return s;
    try { return storeSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })); }
    catch (e) { if (e.status === 400 || e.status === 401) { writeSession(null); write(PKEY, null); return null; } return s; }
  }
  const validDomain = email => String(email).trim().toLowerCase().endsWith(CONFIG.domain);
  const here = () => location.href.split('#')[0].split('?')[0];

  async function signIn(email, password) {
    const d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email.trim().toLowerCase(), password } });
    storeSession(d);
    try { localStorage.setItem('edp-last-email', email.trim().toLowerCase()); } catch (e) {}
    /* Ask the browser / phone to save the login (Chrome, Edge, Android; Safari and iPhone offer it themselves) */
    if (global.PasswordCredential && navigator.credentials) { try { await navigator.credentials.store(new PasswordCredential({ id: email.trim().toLowerCase(), password })); } catch (e) {} }
    await profile(true); return d;
  }
  async function signUp(email, password, fullName) {
    return call('/auth/v1/signup?redirect_to=' + encodeURIComponent(here()), { method: 'POST', body: { email: email.trim().toLowerCase(), password, data: { full_name: fullName.trim() } } });
  }
  const recover = email => call('/auth/v1/recover?redirect_to=' + encodeURIComponent(here()), { method: 'POST', body: { email: email.trim().toLowerCase() } });
  async function setPassword(password) { const s = await session(); return call('/auth/v1/user', { method: 'PUT', token: s.access_token, body: { password } }); }
  async function signOut() {
    const s = readSession();
    if (s && navigator.onLine) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch (e) {} }
    writeSession(null); write(PKEY, null);
  }
  async function profile(force) {
    const cached = read(PKEY);
    if (cached && !force && !navigator.onLine) return cached;
    const s = await session(); if (!s) return null;
    try {
      const rows = await call('/rest/v1/profiles?select=id,email,full_name,role&id=eq.' + s.user.id, { token: s.access_token });
      if (rows && rows[0]) { write(PKEY, rows[0]); return rows[0]; }
    } catch (e) {}
    return cached || { id: s.user.id, email: s.user.email, full_name: (s.user.user_metadata || {}).full_name || '', role: 'worker' };
  }
  async function rest(path, opts = {}) { const s = await session(); if (!s) throw new Error('not signed in'); return call('/rest/v1/' + path, { ...opts, token: s.access_token }); }

  /* ---------- Report registration (offline queue) ---------- */
  function queueReport(rec) {
    const q = read(QKEY) || []; const i = q.findIndex(r => r.id === rec.id);
    if (i >= 0) q[i] = rec; else q.push(rec);
    write(QKEY, q); return flush();
  }
  let flushing = null;
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      const q = read(QKEY) || []; if (!q.length || !navigator.onLine) return { pending: q.length };
      const s = await session(); if (!s) return { pending: q.length };
      const left = [];
      for (const rec of q) {
        try { await call('/rest/v1/reports?on_conflict=id', { method: 'POST', token: s.access_token, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: rec }); }
        catch (e) { left.push(rec); }
      }
      write(QKEY, left); return { pending: left.length };
    })().finally(() => { flushing = null; });
    return flushing;
  }
  global.addEventListener('online', () => flush());
  const pending = () => (read(QKEY) || []).length;

  /* ---------- Login screen ---------- */
  function gateHtml(mode) {
    const names = { gEmail: 'email', gPass: 'password', gName: 'name' };
    const f = (id, type, key, extra = '') => `<label>${t(key)}<input id="${id}" name="${names[id]}" type="${type}" ${extra} required></label>`;
    const forms = {
      login: `<h2>${t('authLogin')}</h2>${f('gEmail', 'email', 'authEmail', 'autocomplete="username" placeholder="naam' + CONFIG.domain + '"')}${f('gPass', 'password', 'authPassword', 'autocomplete="current-password"')}
        <label class="check-row"><input type="checkbox" id="gRemember" ${remember() ? 'checked' : ''}><span>${t('authRemember')}</span></label>
        <button class="primary" type="submit">${t('authLoginBtn')}</button>
        <p class="gate-links"><a href="#" data-mode="register">${t('authNoAccount')}</a> · <a href="#" data-mode="forgot">${t('authForgot')}</a></p>`,
      register: `<h2>${t('authRegister')}</h2>${f('gName', 'text', 'authName', 'autocomplete="name"')}${f('gEmail', 'email', 'authEmail', 'autocomplete="username" placeholder="naam' + CONFIG.domain + '"')}${f('gPass', 'password', 'authPassword', 'autocomplete="new-password" minlength="8"')}
        <p class="muted small">${t('authDomainHint', { d: CONFIG.domain })}</p>
        <button class="primary" type="submit">${t('authRegisterBtn')}</button>
        <p class="gate-links"><a href="#" data-mode="login">${t('authHaveAccount')}</a></p>`,
      forgot: `<h2>${t('authForgotTitle')}</h2>${f('gEmail', 'email', 'authEmail', 'autocomplete="username"')}
        <button class="primary" type="submit">${t('authSendLink')}</button>
        <p class="gate-links"><a href="#" data-mode="login">${t('back')}</a></p>`,
      newpass: `<h2>${t('authNewPassword')}</h2>${f('gPass', 'password', 'authPassword', 'autocomplete="new-password" minlength="8"')}
        <button class="primary" type="submit">${t('authSave')}</button>`
    };
    return `<div class="gate-card"><img src="assets/edp-logo.jpg" alt="EDP" class="gate-logo"><div class="lang-switch gate-lang"></div><form id="gateForm" method="post" action="#" novalidate>${forms[mode]}<p id="gateMsg" class="gate-msg" role="alert"></p></form></div>`;
  }
  function errText(e) {
    const m = String(e && e.message || e);
    if (/invalid login|invalid_credentials/i.test(m)) return t('authErrCredentials');
    if (/not confirmed/i.test(m)) return t('authErrNotConfirmed');
    if (/already registered|already exists/i.test(m)) return t('authErrExists');
    if (/database error|edp\.com/i.test(m)) return t('authDomainHint', { d: CONFIG.domain });
    if (/password/i.test(m) && /least|short|weak/i.test(m)) return t('authErrPassword');
    if (/failed to fetch|network/i.test(m)) return t('authErrOffline');
    if (/rate limit|over_email_send_rate_limit|429/i.test(m)) return t('authErrRate');
    return m;
  }
  let gateState = null;
  function showGate(mode, resolve, opts = {}) {
    gateState = { mode, resolve, opts };
    let el = document.getElementById('gate');
    if (!el) { el = document.createElement('div'); el.id = 'gate'; document.body.appendChild(el); }
    document.body.classList.add('gated');
    el.innerHTML = gateHtml(mode);
    global.I18N.mountSwitch(el.querySelector('.gate-lang'));
    el.querySelectorAll('[data-mode]').forEach(a => a.onclick = ev => { ev.preventDefault(); showGate(a.dataset.mode, resolve); });
    const msg = (s, ok) => { const m = el.querySelector('#gateMsg'); m.textContent = s; m.classList.toggle('ok', !!ok); };
    const v = id => (el.querySelector('#' + id) || {}).value || '';
    const em = el.querySelector('#gEmail');
    if (em) { em.value = opts.email || (mode === 'login' ? lastEmail() : ''); if (mode === 'login' && em.value && !opts.msgKey) { const pw = el.querySelector('#gPass'); if (pw) setTimeout(() => pw.focus(), 50); } }
    if (opts.msgKey) { msg(t(opts.msgKey), true); if (mode === 'login') { const pw = el.querySelector('#gPass'); if (pw) pw.focus(); } }
    el.querySelector('#gateForm').onsubmit = async ev => {
      ev.preventDefault();
      const btn = el.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        if (mode === 'login') { try { localStorage.setItem('edp-remember', el.querySelector('#gRemember').checked ? '1' : '0'); } catch (x) {} await signIn(v('gEmail'), v('gPass')); hideGate(); resolve(await profile()); }
        else if (mode === 'register') {
          if (!v('gName').trim()) throw new Error(t('authErrName'));
          if (!validDomain(v('gEmail'))) throw new Error(t('authDomainHint', { d: CONFIG.domain }));
          if (v('gPass').length < 8) throw new Error(t('authErrPassword'));
          const d = await signUp(v('gEmail'), v('gPass'), v('gName'));
          if (d && d.access_token) { storeSession(d); hideGate(); resolve(await profile(true)); }
          else { showGate('login', resolve, { email: v('gEmail').trim().toLowerCase(), msgKey: 'authCheckMail' }); return; }
        } else if (mode === 'forgot') { await recover(v('gEmail')); showGate('login', resolve, { email: v('gEmail').trim().toLowerCase(), msgKey: 'authResetSent' }); return; }
        else if (mode === 'newpass') { if (v('gPass').length < 8) throw new Error(t('authErrPassword')); await setPassword(v('gPass')); hideGate(); resolve(await profile(true)); }
      } catch (e) { msg(errText(e)); }
      btn.disabled = false;
    };
  }
  global.I18N.onChange(() => { if (gateState && document.body.classList.contains('gated')) showGate(gateState.mode, gateState.resolve, gateState.opts); });
  function hideGate() { gateState = null; const el = document.getElementById('gate'); if (el) el.remove(); document.body.classList.remove('gated'); }

  /* Handle the links from confirmation / password-reset e-mails (#access_token=...&type=...) */
  function consumeHash() {
    if (!location.hash.includes('access_token') && !location.hash.includes('error')) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error')) return { error: p.get('error_description') || p.get('error') };
    storeSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: Number(p.get('expires_at')) || undefined, user: null });
    return { type: p.get('type') };
  }
  async function fetchUser() { const s = readSession(); if (s && !s.user) { try { s.user = await call('/auth/v1/user', { token: s.access_token }); writeSession(s); } catch (e) {} } }

  /* Call once per page: resolves with the profile when signed in (shows the login screen otherwise). */
  function require() {
    return new Promise(async resolve => {
      const h = consumeHash();
      if (h && !h.error) await fetchUser();
      const s = await session();
      if (h && h.type === 'recovery' && s) { showGate('newpass', resolve); return; }
      if (s && s.user) { flush(); resolve(await profile()); return; }
      showGate('login', resolve);
      if (h && h.error) { const m = document.getElementById('gateMsg'); if (m) { m.textContent = /expired|invalid|otp/i.test(h.error) ? t('authLinkUsed') : h.error; m.classList.toggle('ok', /expired|invalid|otp/i.test(h.error)); } }
    });
  }

  global.EDPAuth = { CONFIG, require, signOut, profile, rest, queueReport, flush, pending, validDomain, session };
})(window);
