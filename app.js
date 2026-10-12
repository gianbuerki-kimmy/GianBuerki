(() => {
  'use strict';
  const STORE_KEY = 'schluesselbund.vault.v1';
  const SETTINGS_KEY = 'schluesselbund.settings.v1';
  const ITERATIONS = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let vault = { passwords: [], codes: [] };
  let cryptoKey = null;
  let currentTab = 'passwords';
  let deleteTarget = null;
  let inactivityTimer = null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const unb64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
  const settings = () => {
    try { return { lockMinutes: 5, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { lockMinutes: 5 }; }
  };

  async function deriveKey(password, salt) {
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptVault(data, key, salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, salt: b64(salt), iv: b64(iv), data: b64(encrypted), iterations: ITERATIONS }));
  }

  async function decryptVault(record, key) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(record.iv) }, key, unb64(record.data));
    return JSON.parse(dec.decode(plain));
  }

  async function persist() {
    const record = JSON.parse(localStorage.getItem(STORE_KEY));
    await encryptVault(vault, cryptoKey, unb64(record.salt));
  }

  function showAuth(mode) {
    $('#auth').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#setup-card').classList.toggle('hidden', mode !== 'setup');
    $('#unlock-card').classList.toggle('hidden', mode !== 'unlock');
    setTimeout(() => $(mode === 'setup' ? '#setup-password' : '#unlock-password').focus(), 50);
  }

  function showApp() {
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    render();
    resetInactivity();
  }

  function lock(showMessage = true) {
    clearTimeout(inactivityTimer);
    cryptoKey = null;
    vault = { passwords: [], codes: [] };
    $$('#entry-dialog, #confirm-dialog, #settings-dialog').forEach(dialog => dialog.open && dialog.close());
    $('#unlock-form').reset();
    showAuth('unlock');
    if (showMessage) toast('Tresor wurde gesperrt');
  }

  function resetInactivity() {
    if (!cryptoKey) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => lock(true), settings().lockMinutes * 60 * 1000);
  }

  function escapeHtml(value = '') {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
  }

  function toast(message) {
    const element = document.createElement('div');
    element.className = 'toast';
    element.innerHTML = `${icon('check')}<span>${escapeHtml(message)}</span>`;
    $('#toast-wrap').appendChild(element);
    setTimeout(() => {
      element.classList.add('out');
      setTimeout(() => element.remove(), 220);
    }, 2600);
  }

  const normalizeUrl = value => !value ? '' : (/^https?:\/\//i.test(value) ? value : `https://${value}`);
  const initials = title => (title.trim()[0] || '?').toLocaleUpperCase('de');

  function filteredItems() {
    const query = $('#search-input').value.trim().toLocaleLowerCase('de');
    return vault[currentTab].filter(item => !query || Object.values(item).some(value => typeof value === 'string' && value.toLocaleLowerCase('de').includes(query)));
  }

  function passwordCard(item) {
    const url = normalizeUrl(item.url);
    return `<article class="item-card" data-id="${escapeHtml(item.id)}">
      <div class="card-top">
        <div class="site-icon">${escapeHtml(initials(item.title))}</div>
        <div class="card-title"><h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>` : '<span>Zugangsdaten</span>'}</div>
        <div class="card-actions"><button class="btn btn-icon edit-btn" type="button" aria-label="Bearbeiten" title="Bearbeiten">${icon('edit')}</button><button class="btn btn-icon delete-btn" type="button" aria-label="Löschen" title="Löschen">${icon('trash')}</button></div>
      </div>
      <div class="data-row"><div class="data-label"><small>Benutzername</small><span class="data-value">${escapeHtml(item.username)}</span></div><button class="btn btn-icon copy-btn" type="button" data-copy="username" aria-label="Benutzername kopieren" title="Benutzername kopieren">${icon('copy')}</button></div>
      <div class="data-row"><div class="data-label"><small>Passwort</small><span class="data-value password-value">••••••••••••</span></div><button class="btn btn-icon reveal-btn" type="button" aria-label="Passwort kurz anzeigen" title="Passwort anzeigen">${icon('eye')}</button><button class="btn btn-icon copy-btn" type="button" data-copy="password" aria-label="Passwort kopieren" title="Passwort kopieren">${icon('copy')}</button></div>
    </article>`;
  }

  function codeCard(item) {
    return `<article class="item-card" data-id="${escapeHtml(item.id)}">
      <div class="card-top">
        <div class="site-icon coupon">${icon('ticket')}</div>
        <div class="card-title"><h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3><span>Rabatt- oder Gutscheincode</span></div>
        <div class="card-actions"><button class="btn btn-icon edit-btn" type="button" aria-label="Bearbeiten" title="Bearbeiten">${icon('edit')}</button><button class="btn btn-icon delete-btn" type="button" aria-label="Löschen" title="Löschen">${icon('trash')}</button></div>
      </div>
      <div class="data-row"><div class="data-label"><small>Code</small><span class="data-value">${escapeHtml(item.code)}</span></div><button class="btn btn-icon copy-btn" type="button" data-copy="code" aria-label="Code kopieren" title="Code kopieren">${icon('copy')}</button></div>
      ${item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : ''}
    </article>`;
  }

  function render() {
    const isPasswords = currentTab === 'passwords';
    const items = filteredItems();
    const query = $('#search-input').value.trim();
    $('#page-title').textContent = isPasswords ? 'Passwörter' : 'Rabattcodes';
    $('#section-title').textContent = isPasswords ? 'Deine Zugangsdaten' : 'Deine gespeicherten Codes';
    $('#section-subtitle').textContent = isPasswords ? 'Sicher gespeichert und schnell zur Hand.' : 'Gutscheine und Rabatte an einem Ort.';
    $('#add-label').textContent = isPasswords ? 'Neuer Eintrag' : 'Neuer Code';
    $('#search-input').placeholder = isPasswords ? 'Passwörter durchsuchen …' : 'Rabattcodes durchsuchen …';
    $('#password-count-side').textContent = vault.passwords.length;
    $('#code-count-side').textContent = vault.codes.length;
    $$('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === currentTab));
    const grid = $('#items-grid');
    if (!items.length) {
      const title = query ? `Keine Treffer für „${escapeHtml(query)}“` : (isPasswords ? 'Noch keine Passwörter gespeichert' : 'Noch keine Rabattcodes gespeichert');
      const description = query ? 'Versuche es mit einem anderen Suchbegriff.' : (isPasswords ? 'Lege deinen ersten Zugang sicher im Tresor ab.' : 'Speichere deinen ersten Gutschein für später.');
      grid.innerHTML = `<div class="empty"><div class="empty-icon">${icon(isPasswords ? 'lock' : 'ticket')}</div><h3>${title}</h3><p>${description}</p>${query ? '' : `<button class="btn btn-primary empty-add" type="button">${icon('plus')}${isPasswords ? 'Passwort hinzufügen' : 'Code hinzufügen'}</button>`}</div>`;
      $('.empty-add')?.addEventListener('click', openAdd);
      return;
    }
    grid.innerHTML = items.map(item => isPasswords ? passwordCard(item) : codeCard(item)).join('');
  }

  function configureDialog(item = null) {
    const isPasswords = currentTab === 'passwords';
    $('#entry-form').reset();
    $('#entry-id').value = item?.id || '';
    $('#password-fields').classList.toggle('hidden', !isPasswords);
    $('#code-fields').classList.toggle('hidden', isPasswords);
    $('#entry-username').required = isPasswords;
    $('#entry-password').required = isPasswords;
    $('#entry-code').required = !isPasswords;
    $('#title-label').firstChild.textContent = isPasswords ? 'Webseite oder Portal' : 'Webseite oder Shop';
    $('#dialog-title').textContent = `${isPasswords ? 'Passwort' : 'Rabattcode'} ${item ? 'bearbeiten' : 'hinzufügen'}`;
    $('#dialog-subtitle').textContent = isPasswords ? 'Zugangsdaten sicher im Tresor ablegen.' : 'Code speichern und bei Bedarf schnell kopieren.';
    $('#save-label').textContent = item ? 'Änderungen speichern' : 'Speichern';
    if (item) {
      $('#entry-title').value = item.title || '';
      if (isPasswords) {
        $('#entry-username').value = item.username || '';
        $('#entry-password').value = item.password || '';
        $('#entry-url').value = item.url || '';
      } else {
        $('#entry-code').value = item.code || '';
        $('#entry-note').value = item.note || '';
      }
    }
  }

  function openAdd() {
    configureDialog();
    $('#entry-dialog').showModal();
    setTimeout(() => $('#entry-title').focus(), 40);
  }

  function openEdit(id) {
    const item = vault[currentTab].find(entry => entry.id === id);
    if (!item) return;
    configureDialog(item);
    $('#entry-dialog').showModal();
  }

  function askDelete(id) {
    const item = vault[currentTab].find(entry => entry.id === id);
    if (!item) return;
    deleteTarget = id;
    $('#confirm-text').textContent = `„${item.title}“ wird unwiderruflich aus deinem Tresor gelöscht.`;
    $('#confirm-dialog').showModal();
  }

  async function copyText(value, label) {
    try { await navigator.clipboard.writeText(value); }
    catch {
      const input = document.createElement('textarea');
      input.value = value; input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.append(input); input.select(); document.execCommand('copy'); input.remove();
    }
    toast(`${label} kopiert`);
  }

  $('#setup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('#setup-password').value;
    const confirmation = $('#setup-confirm').value;
    const error = $('#setup-error');
    error.textContent = '';
    if (password.length < 10) { error.textContent = 'Bitte verwende mindestens 10 Zeichen.'; return; }
    if (password !== confirmation) { error.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      cryptoKey = await deriveKey(password, salt);
      vault = { passwords: [], codes: [] };
      await encryptVault(vault, cryptoKey, salt);
      $('#setup-form').reset();
      showApp();
      toast('Dein verschlüsselter Tresor ist bereit');
    } catch { error.textContent = 'Der Tresor konnte in diesem Browser nicht erstellt werden.'; }
  });

  $('#unlock-form').addEventListener('submit', async event => {
    event.preventDefault();
    const error = $('#unlock-error');
    error.textContent = '';
    try {
      const record = JSON.parse(localStorage.getItem(STORE_KEY));
      const key = await deriveKey($('#unlock-password').value, unb64(record.salt));
      const data = await decryptVault(record, key);
      cryptoKey = key;
      vault = { passwords: data.passwords || [], codes: data.codes || [] };
      $('#unlock-form').reset();
      showApp();
      toast('Tresor entsperrt');
    } catch { cryptoKey = null; error.textContent = 'Das Master-Passwort ist nicht korrekt.'; }
  });

  $$('.toggle-input').forEach(button => button.addEventListener('click', () => {
    const input = button.previousElementSibling;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.innerHTML = icon(reveal ? 'eye-off' : 'eye');
    button.setAttribute('aria-label', reveal ? 'Passwort verbergen' : 'Passwort anzeigen');
  }));

  $('#forgot-password').addEventListener('click', () => {
    $('#reset-confirmation').value = '';
    $('#confirm-reset').disabled = true;
    $('#reset-dialog').showModal();
    setTimeout(() => $('#reset-confirmation').focus(), 40);
  });
  $('#reset-confirmation').addEventListener('input', event => {
    $('#confirm-reset').disabled = event.target.value.trim() !== 'ZURÜCKSETZEN';
  });
  $('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
  $('#confirm-reset').addEventListener('click', () => {
    if ($('#reset-confirmation').value.trim() !== 'ZURÜCKSETZEN') return;
    localStorage.removeItem(STORE_KEY);
    cryptoKey = null;
    vault = { passwords: [], codes: [] };
    $('#reset-dialog').close();
    $('#unlock-form').reset();
    showAuth('setup');
    toast('Tresor wurde zurückgesetzt');
  });

  $$('[data-tab]').forEach(button => button.addEventListener('click', () => {
    currentTab = button.dataset.tab;
    $('#search-input').value = '';
    render();
  }));
  $$('.lock-btn').forEach(button => button.addEventListener('click', () => lock(true)));
  $('#search-input').addEventListener('input', render);
  $('#add-btn').addEventListener('click', openAdd);
  $$('.close-dialog').forEach(button => button.addEventListener('click', () => $('#entry-dialog').close()));
  $('#entry-dialog').addEventListener('click', event => { if (event.target === $('#entry-dialog')) $('#entry-dialog').close(); });

  $('#entry-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#entry-id').value;
    const base = { id: id || uid(), title: $('#entry-title').value.trim(), updatedAt: Date.now() };
    const item = currentTab === 'passwords'
      ? { ...base, username: $('#entry-username').value.trim(), password: $('#entry-password').value, url: $('#entry-url').value.trim() }
      : { ...base, code: $('#entry-code').value.trim(), note: $('#entry-note').value.trim() };
    if (id) vault[currentTab] = vault[currentTab].map(entry => entry.id === id ? item : entry);
    else vault[currentTab].unshift(item);
    await persist();
    $('#entry-dialog').close();
    render();
    toast(id ? 'Änderungen gespeichert' : (currentTab === 'passwords' ? 'Passwort sicher gespeichert' : 'Rabattcode gespeichert'));
  });

  $('#generate-password').addEventListener('click', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=?';
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    $('#entry-password').value = [...bytes].map(value => chars[value % chars.length]).join('');
    $('#entry-password').type = 'text';
    toast('Sicheres Passwort erzeugt');
  });

  $('#items-grid').addEventListener('click', event => {
    const card = event.target.closest('.item-card');
    if (!card) return;
    const id = card.dataset.id;
    const item = vault[currentTab].find(entry => entry.id === id);
    if (!item) return;
    if (event.target.closest('.edit-btn')) openEdit(id);
    if (event.target.closest('.delete-btn')) askDelete(id);
    const copy = event.target.closest('.copy-btn');
    if (copy) copyText(item[copy.dataset.copy], copy.dataset.copy === 'username' ? 'Benutzername' : copy.dataset.copy === 'password' ? 'Passwort' : 'Code');
    const reveal = event.target.closest('.reveal-btn');
    if (reveal) {
      const value = $('.password-value', card);
      const showing = reveal.dataset.showing === 'true';
      value.textContent = showing ? '••••••••••••' : item.password;
      reveal.dataset.showing = String(!showing);
      reveal.innerHTML = icon(showing ? 'eye' : 'eye-off');
      if (!showing) setTimeout(() => {
        if (reveal.isConnected) {
          value.textContent = '••••••••••••'; reveal.dataset.showing = 'false'; reveal.innerHTML = icon('eye');
        }
      }, 5000);
    }
  });

  $('#cancel-delete').addEventListener('click', () => { deleteTarget = null; $('#confirm-dialog').close(); });
  $('#confirm-delete').addEventListener('click', async () => {
    if (!deleteTarget) return;
    vault[currentTab] = vault[currentTab].filter(entry => entry.id !== deleteTarget);
    deleteTarget = null;
    await persist();
    $('#confirm-dialog').close();
    render();
    toast('Eintrag gelöscht');
  });

  $('#settings-btn').addEventListener('click', () => {
    $('#lock-timeout').value = String(settings().lockMinutes);
    $('#settings-dialog').showModal();
  });
  $$('.close-settings').forEach(button => button.addEventListener('click', () => $('#settings-dialog').close()));
  $('#settings-form').addEventListener('submit', event => {
    event.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lockMinutes: Number($('#lock-timeout').value) }));
    $('#settings-dialog').close();
    resetInactivity();
    toast('Sicherheitseinstellung gespeichert');
  });

  ['pointerdown', 'keydown', 'touchstart'].forEach(name => document.addEventListener(name, resetInactivity, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resetInactivity(); });
  window.addEventListener('beforeunload', () => { cryptoKey = null; });

  if (!window.crypto?.subtle) {
    $('#auth').innerHTML = '<section class="auth-card"><h1>Browser nicht unterstützt</h1><p>Diese App benötigt einen modernen Browser mit Web-Crypto-Unterstützung.</p></section>';
  } else {
    showAuth(localStorage.getItem(STORE_KEY) ? 'unlock' : 'setup');
  }
})();
