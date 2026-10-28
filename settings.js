/* EDP Reports - settings for the administrator: who may read the VCA overview */
(() => {
  'use strict';
  const { t, esc, toast } = EDP;
  const $ = s => document.querySelector(s);
  const ROLES = ['worker', 'supervisor', 'admin'];
  let me = null, profiles = [], invites = [];

  const STD = EDPAuth.CONFIG.target;
  const targetInput = (v, attrs) => `<label class="target-field">${esc(t('setTarget'))}<input type="number" inputmode="numeric" min="0" max="52" step="1" ${attrs} value="${v ?? ''}" placeholder="${STD}"></label>`;
  const parseTarget = v => { v = String(v).trim(); if (v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 52 ? n : NaN; };
  const roleSelect = (role, attrs = '') => `<select ${attrs}>${ROLES.map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${esc(t('role_' + r))}</option>`).join('')}</select>`;

  async function load() {
    $('#saveStatus').textContent = '…';
    try {
      [profiles, invites] = await Promise.all([
        EDPAuth.rest('profiles?select=id,email,full_name,role,vca_target&order=full_name'),
        EDPAuth.rest('extra_allowed_emails?select=email,role,vca_target&order=email')
      ]);
      $('#saveStatus').textContent = '';
    } catch (e) { toast(t('dashLoadError'), 4000); $('#saveStatus').textContent = ''; }
    render();
  }

  function render() {
    $('#targetIntro').textContent = t('setTargetIntro', { n: STD });
    $('#inviteIntro').textContent = t('setInviteIntro', { d: EDPAuth.CONFIG.domain });
    $('#inviteRole').innerHTML = ROLES.map(r => `<option value="${r}" ${r === 'supervisor' ? 'selected' : ''}>${esc(t('role_' + r))}</option>`).join('');
    const q = $('#search').value.trim().toLowerCase();
    const list = profiles.filter(p => !q || (p.full_name + ' ' + p.email).toLowerCase().includes(q));
    $('#userList').innerHTML = list.length ? list.map(p => `<div class="user-item">
        <div class="who"><strong>${esc(p.full_name || '—')}${p.id === me.id ? ` <small class="muted">(${esc(t('setYou'))})</small>` : ''}</strong><small class="muted">${esc(p.email)}</small></div>
        <div class="what">${p.id === me.id ? `<span class="pill track">${esc(t('role_' + p.role))}</span>` : roleSelect(p.role, `data-id="${p.id}"`)}<small class="muted">${esc(t('setRoleHelp_' + p.role))}</small>${targetInput(p.vca_target, `data-target="${p.id}"`)}</div>
      </div>`).join('') : `<p class="muted">${esc(t('dashNone'))}</p>`;
    document.querySelectorAll('[data-target]').forEach(inp => inp.onchange = async () => {
      const p = profiles.find(x => x.id === inp.dataset.target), v = parseTarget(inp.value);
      if (Number.isNaN(v)) { toast(t('setTargetInvalid')); inp.value = p.vca_target ?? ''; return; }
      try {
        const r = await EDPAuth.rest('profiles?id=eq.' + p.id, { method: 'PATCH', body: { vca_target: v }, headers: { Prefer: 'return=representation' } });
        if (!Array.isArray(r) || !r[0] || (r[0].vca_target ?? null) !== v) throw new Error('not saved');
        p.vca_target = v; toast(t('setTargetSaved', { n: v ?? STD }));
      } catch (e) { inp.value = p.vca_target ?? ''; toast(t('setSaveError'), 4000); }
    });
    document.querySelectorAll('#userList select').forEach(sel => sel.onchange = async () => {
      const p = profiles.find(x => x.id === sel.dataset.id), old = p.role;
      if (sel.value === 'admin' && !confirm(t('setConfirmAdmin', { n: p.full_name || p.email }))) { sel.value = old; return; }
      try {
        const r = await EDPAuth.rest('profiles?id=eq.' + p.id, { method: 'PATCH', body: { role: sel.value }, headers: { Prefer: 'return=representation' } });
        if (!Array.isArray(r) || !r[0] || r[0].role !== sel.value) throw new Error('not saved');
        p.role = sel.value; toast(t('dashRoleSaved')); render();
      } catch (e) { sel.value = old; toast(t('setSaveError'), 4000); }
    });

    $('#inviteList').innerHTML = invites.length ? invites.map(i => `<div class="user-item">
        <div class="who"><strong>${esc(i.email)}</strong></div>
        <div class="what">${roleSelect(i.role, `data-email="${esc(i.email)}"`)}${targetInput(i.vca_target, `data-itarget="${esc(i.email)}"`)}<button type="button" class="secondary compact" data-del="${esc(i.email)}">${esc(t('setRemove'))}</button></div>
      </div>`).join('') : `<p class="muted">${esc(t('setInviteNone'))}</p>`;
    document.querySelectorAll('#inviteList select').forEach(sel => sel.onchange = async () => {
      try { await EDPAuth.rest('extra_allowed_emails?email=eq.' + encodeURIComponent(sel.dataset.email), { method: 'PATCH', body: { role: sel.value }, headers: { Prefer: 'return=minimal' } }); invites.find(i => i.email === sel.dataset.email).role = sel.value; toast(t('dashRoleSaved')); }
      catch (e) { toast(t('setSaveError'), 4000); }
    });
    document.querySelectorAll('[data-itarget]').forEach(inp => inp.onchange = async () => {
      const i = invites.find(x => x.email === inp.dataset.itarget), v = parseTarget(inp.value);
      if (Number.isNaN(v)) { toast(t('setTargetInvalid')); inp.value = i.vca_target ?? ''; return; }
      try { await EDPAuth.rest('extra_allowed_emails?email=eq.' + encodeURIComponent(i.email), { method: 'PATCH', body: { vca_target: v }, headers: { Prefer: 'return=minimal' } }); i.vca_target = v; toast(t('setTargetSaved', { n: v ?? STD })); }
      catch (e) { toast(t('setSaveError'), 4000); }
    });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      try { await EDPAuth.rest('extra_allowed_emails?email=eq.' + encodeURIComponent(b.dataset.del), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); invites = invites.filter(i => i.email !== b.dataset.del); render(); }
      catch (e) { toast(t('setSaveError'), 4000); }
    });
  }

  $('#search').oninput = render;
  $('#inviteForm').onsubmit = async ev => {
    ev.preventDefault();
    const email = $('#inviteEmail').value.trim().toLowerCase(), role = $('#inviteRole').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast(t('setInvalidEmail')); return; }
    if (profiles.some(p => p.email === email)) { toast(t('setInviteExists'), 4000); return; }
    try {
      await EDPAuth.rest('extra_allowed_emails?on_conflict=email', { method: 'POST', body: { email, role }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      invites = invites.filter(i => i.email !== email).concat({ email, role }).sort((a, b) => a.email.localeCompare(b.email));
      $('#inviteEmail').value = ''; toast(t('setInviteAdded')); render();
    } catch (e) { toast(t('setSaveError'), 4000); }
  };

  I18N.onChange(() => { if (me && me.role === 'admin') render(); });
  EDP.initShell();
  EDPAuth.require().then(async p => {
    me = await EDPAuth.profile(true) || p;
    if (!me || me.role !== 'admin') { $('#noAccess').classList.remove('hidden'); return; }
    $('#settings').classList.remove('hidden');
    load();
  });
})();
