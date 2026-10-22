// Kleine DOM-Helfer ohne Framework
import { t } from '../i18n.js';

const SVGNS = 'http://www.w3.org/2000/svg';

function apply(el, attrs, isSvg) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (!isSvg && k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag); apply(el, attrs, false); append(el, children); return el;
}
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag); apply(el, attrs, true); append(el, children); return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 10);

let settingsRef = { haptics: true, sound: true };
export const bindSettings = (s2) => { settingsRef = s2; };

export function haptic(pattern = 12) {
  if (settingsRef.haptics && navigator.vibrate) try { navigator.vibrate(pattern); } catch { /* nicht unterstützt */ }
}

let ac;
function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, when = 0) {
  if (!settingsRef.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = ac.currentTime + when;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* Audio nicht verfügbar */ }
}
export const sound = {
  tick: () => tone(880, 0.05, 'square', 0.06),
  ok: () => { tone(660, 0.09); tone(990, 0.14, 'sine', 0.18, 0.08); },
  fail: () => { tone(220, 0.22, 'sawtooth', 0.12); },
  whistle: () => { tone(2300, 0.25, 'triangle', 0.12); tone(2500, 0.2, 'triangle', 0.1, 0.05); },
  level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'sine', 0.16, i * 0.09)),
};

export function toast(msg, kind = '') {
  let host = $('#toasts');
  if (!host) { host = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
  const el = h('div', { class: 'toast ' + kind }, msg);
  host.append(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2600);
}

/** Modal-Dialog. actions: [{label, kind, onClick(close) → false verhindert Schliessen}] */
export function modal({ title, body, actions = [], wide = false }) {
  const prev = document.activeElement;
  const close = () => { back.remove(); prev?.focus?.(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    title ? h('h2', { class: 'modal-title' }, title) : null,
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions.map((a) => h('button', {
      class: 'btn ' + (a.kind || ''), onclick: () => { if (a.onClick?.(close) !== false) close(); },
    }, a.label))) : null);
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } }, box);
  document.body.append(back);
  document.addEventListener('keydown', esc);
  setTimeout(() => (box.querySelector('input,select,button') || box).focus?.(), 30);
  return close;
}

export function confirmDialog(text, onYes, yesLabel = t('del')) {
  modal({ title: text, body: '', actions: [{ label: t('cancel') }, { label: yesLabel, kind: 'danger', onClick: onYes }] });
}

/** Segmentierte Auswahl (Chips). */
export function segmented(options, value, onChange, cls = '') {
  const wrap = h('div', { class: 'seg ' + cls, role: 'tablist' });
  const render = (v) => {
    clear(wrap);
    for (const o of options) {
      wrap.append(h('button', {
        class: 'seg-btn' + (o.value === v ? ' on' : ''), role: 'tab', 'aria-selected': String(o.value === v),
        onclick: () => { haptic(8); render(o.value); onChange(o.value); },
      }, o.label));
    }
  };
  render(value);
  return wrap;
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function select(options, value, onChange, attrs = {}) {
  const el = h('select', { ...attrs, onchange: (e) => onChange(e.target.value) }, options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return el;
}

export function toggle(label, checked, onChange) {
  return h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked, onchange: (e) => { haptic(6); onChange(e.target.checked); } }),
    h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }), h('span', { class: 'toggle-label' }, label));
}

export const fmtPct = (x) => (x == null || isNaN(x) ? '–' : Math.round(x * 100) + ' %');
export const fmtMs = (ms) => (ms == null || isNaN(ms) ? '–' : (ms / 1000).toFixed(1) + ' s');
