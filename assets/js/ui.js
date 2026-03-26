// assets/js/ui.js
// Promise-based dialog system — replaces browser alert / prompt / confirm

const overlay = document.getElementById('ui-overlay');
const toastEl = document.getElementById('ui-toast');
let _toastTimer = null;

function _show(dialogEl) {
  overlay.innerHTML = '';
  overlay.appendChild(dialogEl);
  overlay.classList.add('open');
}

function _close(dialogEl, resolve, value) {
  dialogEl.classList.add('closing');
  dialogEl.addEventListener('animationend', () => {
    overlay.classList.remove('open');
    overlay.innerHTML = '';
    resolve(value);
  }, { once: true });
}

// ── alert ──────────────────────────────────────────────────────────────────
export function alert(msg, { title = null, icon = '🐺' } = {}) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'ui-dialog';
    box.innerHTML = `
      <div class="ui-dialog-icon">${icon}</div>
      ${title ? `<p class="ui-dialog-title">${title}</p>` : ''}
      <p class="ui-dialog-msg">${msg}</p>
      <div class="ui-dialog-actions">
        <button class="ui-btn ui-btn-primary">OK</button>
      </div>`;
    box.querySelector('.ui-btn').addEventListener('click', () => _close(box, resolve));
    _show(box);
  });
}

// ── confirm ─────────────────────────────────────────────────────────────────
export function confirm(msg, {
  title       = null,
  icon        = '⚠️',
  confirmLabel = 'Conferma',
  danger      = false
} = {}) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'ui-dialog';
    box.innerHTML = `
      <div class="ui-dialog-icon">${icon}</div>
      ${title ? `<p class="ui-dialog-title">${title}</p>` : ''}
      <p class="ui-dialog-msg">${msg}</p>
      <div class="ui-dialog-actions">
        <button class="ui-btn ${danger ? 'ui-btn-danger' : 'ui-btn-primary'}">${confirmLabel}</button>
        <button class="ui-btn ui-btn-secondary">Annulla</button>
      </div>`;
    const [ok, cancel] = box.querySelectorAll('.ui-btn');
    ok.addEventListener('click',     () => _close(box, resolve, true));
    cancel.addEventListener('click', () => _close(box, resolve, false));
    _show(box);
  });
}

// ── prompt ──────────────────────────────────────────────────────────────────
export function prompt(msg, {
  title        = null,
  icon         = '✍️',
  placeholder  = '',
  defaultValue = '',
  validate     = null   // fn(value) → stringa errore | null
} = {}) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'ui-dialog';
    box.innerHTML = `
      <div class="ui-dialog-icon">${icon}</div>
      ${title ? `<p class="ui-dialog-title">${title}</p>` : ''}
      <p class="ui-dialog-msg">${msg}</p>
      <input class="ui-dialog-input" type="text"
             placeholder="${placeholder}" value="${defaultValue}" />
      <p class="ui-input-error"></p>
      <div class="ui-dialog-actions">
        <button class="ui-btn ui-btn-primary">Continua</button>
        <button class="ui-btn ui-btn-secondary">Annulla</button>
      </div>`;
    const input    = box.querySelector('input');
    const errorEl  = box.querySelector('.ui-input-error');
    const [ok, cancel] = box.querySelectorAll('.ui-btn');

    function checkValid() {
      if (!validate) return true;
      const err = validate(input.value.trim());
      errorEl.textContent = err ?? '';
      errorEl.style.display = err ? 'block' : 'none';
      return !err;
    }

    setTimeout(() => input.focus(), 40);
    input.addEventListener('input', checkValid);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  ok.click();
      if (e.key === 'Escape') cancel.click();
    });
    ok.addEventListener('click', () => {
      if (!checkValid()) return;
      _close(box, resolve, input.value.trim() || null);
    });
    cancel.addEventListener('click', () => _close(box, resolve, null));
    _show(box);
  });
}

// ── toast ───────────────────────────────────────────────────────────────────
export function toast(msg, duration = 2400) {
  if (_toastTimer) clearTimeout(_toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('visible');
  _toastTimer = setTimeout(() => toastEl.classList.remove('visible'), duration);
}
