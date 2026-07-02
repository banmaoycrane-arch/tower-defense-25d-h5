/* global LEADERBOARD_CONFIG */
(function () {
'use strict';

const PHONE_KEY = 'td3d_player_phone';
let sessionPhone = '';

function cfg() {
  return window.LEADERBOARD_CONFIG || { apiBase: '' };
}

function getApiBase() {
  const base = (cfg().apiBase || '').replace(/\/$/, '');
  if (base) return base;
  if (typeof location !== 'undefined' && location.origin && location.protocol.startsWith('http')) {
    return location.origin;
  }
  return '';
}

function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function maskPhone(phone) {
  const p = normalizePhone(phone);
  if (p.length === 11) return p.slice(0, 3) + '****' + p.slice(7);
  if (p.length >= 4) return '用户' + p.slice(-4);
  return '未登录';
}

function getStoredPhone() {
  if (sessionPhone && validatePhone(sessionPhone)) return sessionPhone;
  try {
    const saved = localStorage.getItem(PHONE_KEY) || '';
    if (saved) sessionPhone = saved;
    return saved;
  } catch (e) {
    return sessionPhone || '';
  }
}

function setStoredPhone(phone) {
  const p = normalizePhone(phone);
  if (!validatePhone(p)) return false;
  sessionPhone = p;
  try {
    localStorage.setItem(PHONE_KEY, p);
  } catch (e) { /* Safari 无痕模式 */ }
  return true;
}

function getDisplayName() {
  const phone = getStoredPhone();
  return phone ? maskPhone(phone) : '未登录';
}

function isLoggedIn() {
  return validatePhone(getStoredPhone());
}

function apiVerifyPhone(phone) {
  const base = getApiBase();
  if (!base) return Promise.resolve({ ok: true, phone, displayName: maskPhone(phone) });

  return fetch(`${base}/api/auth/phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
    .then((res) => res.json())
    .catch(() => ({ ok: true, phone, displayName: maskPhone(phone) }));
}

function showLoginHint(msg) {
  const el = document.getElementById('login-hint');
  if (el) {
    el.textContent = msg || '';
    el.classList.toggle('visible', !!msg);
  }
}

function ensurePhoneLogin() {
  if (isLoggedIn()) {
    showLoginHint('');
    return Promise.resolve(getDisplayName());
  }

  const input = document.getElementById('player-phone');
  const raw = input ? input.value : '';
  const phone = normalizePhone(raw);

  if (!validatePhone(phone)) {
    const msg = '请先输入正确的 11 位手机号';
    showLoginHint(msg);
    if (input) {
      input.focus();
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return Promise.reject(new Error('invalid phone'));
  }

  return apiVerifyPhone(phone).then((data) => {
    const p = (data && data.phone) ? normalizePhone(data.phone) : phone;
    if (!setStoredPhone(p)) {
      showLoginHint('登录失败，请重试');
      throw new Error('save failed');
    }
    if (input) input.value = p;
    showLoginHint('');
    return (data && data.displayName) || maskPhone(p);
  });
}

function bindPhoneInput() {
  const input = document.getElementById('player-phone');
  if (!input) return;
  const saved = getStoredPhone();
  if (saved) input.value = saved;
  input.addEventListener('input', () => {
    input.value = normalizePhone(input.value).slice(0, 11);
  });
}

window.Auth = {
  getDisplayName,
  getStoredPhone,
  setStoredPhone,
  maskPhone,
  validatePhone,
  isLoggedIn,
  ensurePhoneLogin,
  bindPhoneInput,
  showLoginHint,
};

})();
