// RotationPro – App-Shell: Router, Navigation, Onboarding
import { t, setLang, addStrings, getLang } from './i18n.js';
import { h, $, clear, modal, segmented, bindSettings, haptic, select } from './ui/dom.js';
import { state, loadState, persist } from './ui/store.js';
import { PRESET_SYSTEMS } from './engine/systems.js';
import { PLAYABLE_ROLES } from './engine/core.js';
import { icon } from './ui/icons.js';

addStrings({
  de: {
    welcome: 'Willkommen bei RotationPro', welcomeText: 'Plane Aufstellungen, verstehe Rotationen und trainiere deine Position.',
    yourRole: 'Deine Rolle', yourSystem: 'Euer System', coach: 'Trainer/in – alle Rollen', letsGo: 'Los geht\'s', language: 'Sprache',
    changeRole: 'Rolle ändern', roleHint: 'Deine Rolle steuert „Meine Position" in Lernen, Quiz und Match.',
    'nav.squad': 'Kader', 'nav.systems': 'Systeme', 'nav.stats': 'Statistik', 'nav.tactics': 'Taktiktafel', 'nav.settings': 'Einstellungen',
    offlineReady: 'Offline bereit', updateReady: 'Neue Version geladen – neu starten?', reload: 'Neu starten',
  },
  en: {
    welcome: 'Welcome to RotationPro', welcomeText: 'Plan lineups, understand rotations and train your position.',
    yourRole: 'Your role', yourSystem: 'Your system', coach: 'Coach – all roles', letsGo: 'Let\'s go', language: 'Language',
    changeRole: 'Change role', roleHint: 'Your role drives "My position" in Learn, Quiz and Match.',
    'nav.squad': 'Squad', 'nav.systems': 'Systems', 'nav.stats': 'Stats', 'nav.tactics': 'Tactics board', 'nav.settings': 'Settings',
    offlineReady: 'Ready to work offline', updateReady: 'New version available – restart?', reload: 'Restart',
  },
});

const VIEWS = {
  field: () => import('./modes/field.js'),
  learn: () => import('./modes/learn.js'),
  quiz: () => import('./modes/quiz.js'),
  game: () => import('./modes/game.js'),
  more: () => import('./modes/more.js'),
  squad: () => import('./modes/squad.js'),
  systems: () => import('./modes/systems.js'),
  stats: () => import('./modes/stats.js'),
  tactics: () => import('./modes/tactics.js'),
  settings: () => import('./modes/settings.js'),
};
const NAV = [
  { id: 'field', icon: 'court' }, { id: 'learn', icon: 'book' }, { id: 'quiz', icon: 'quiz' }, { id: 'game', icon: 'bolt' }, { id: 'more', icon: 'more' },
];
const NAV_PARENT = { squad: 'more', systems: 'more', stats: 'more', tactics: 'more', settings: 'more' };

let current = null;

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.settings.theme === 'light' ? '#EEF2F7' : '#0F1B2E');
}

function renderChrome() {
  const header = $('#topbar');
  clear(header);
  const role = state.settings.myRole;
  header.append(
    h('a', { class: 'brand', href: '#/field', 'aria-label': 'RotationPro' }, h('span', { class: 'brand-ball', 'aria-hidden': 'true' }), 'RotationPro'),
    h('div', { class: 'top-actions' },
      h('button', { class: 'chip role-chip ' + (role ? 'r-' + role : ''), onclick: rolePicker, 'aria-label': t('changeRole') }, role ? t('role.' + role) : t('coach')),
      h('button', { class: 'icon-btn', 'aria-label': t('language'), onclick: () => { state.settings.lang = getLang() === 'de' ? 'en' : 'de'; persist('settings'); setLang(state.settings.lang); renderChrome(); route(); } }, getLang() === 'de' ? 'EN' : 'DE'),
      h('button', { class: 'icon-btn', 'aria-label': 'Theme', onclick: () => { state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light'; persist('settings'); applyTheme(); renderChrome(); } }, icon(state.settings.theme === 'light' ? 'moon' : 'sun', 20)),
    ),
  );
  const nav = $('#nav');
  clear(nav);
  for (const n of NAV) {
    nav.append(h('a', { href: '#/' + n.id, class: 'nav-item', 'data-nav': n.id, onclick: () => haptic(6) }, icon(n.icon, 24), h('span', {}, t('nav.' + n.id))));
  }
}

export function rolePicker(onDone) {
  let role = state.settings.myRole;
  let sys = state.settings.mySystem;
  const grid = h('div', { class: 'role-grid' });
  const draw = () => {
    clear(grid);
    for (const r of [...PLAYABLE_ROLES, null]) {
      grid.append(h('button', { class: 'role-pick ' + (r ? 'r-' + r : 'r-coach') + (role === r ? ' on' : ''), onclick: () => { role = r; haptic(8); draw(); } },
        h('span', { class: 'role-dot' }), r ? t('role.' + r) : t('coach')));
    }
  };
  draw();
  const sysSel = select([...PRESET_SYSTEMS, ...state.customSystems].map((s2) => ({ value: s2.id, label: s2.name })), sys, (v) => { sys = v; });
  modal({
    title: t('changeRole'),
    body: h('div', {}, h('p', { class: 'muted' }, t('roleHint')), grid, h('label', { class: 'field' }, h('span', { class: 'field-label' }, t('yourSystem')), sysSel)),
    actions: [{ label: t('cancel') }, { label: t('save'), kind: 'primary', onClick: () => {
      state.settings.myRole = role; state.settings.mySystem = sys;
      if (!role) state.settings.focus = 'all';
      persist('settings'); renderChrome(); route(); if (typeof onDone === 'function') onDone();
    } }],
  });
}

function onboarding() {
  let role = 'OH', sys = '5-1';
  const grid = h('div', { class: 'role-grid' });
  const draw = () => {
    clear(grid);
    for (const r of [...PLAYABLE_ROLES, null]) {
      grid.append(h('button', { class: 'role-pick ' + (r ? 'r-' + r : 'r-coach') + (role === r ? ' on' : ''), onclick: () => { role = r; haptic(8); draw(); } }, h('span', { class: 'role-dot' }), r ? t('role.' + r) : t('coach')));
    }
  };
  draw();
  const body = h('div', { class: 'onboard' },
    h('p', {}, t('welcomeText')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('language')), segmented([{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }], getLang(), (v) => {
      state.settings.lang = v; setLang(v); persist('settings'); close(); renderChrome(); onboarding();
    })),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('yourRole')), grid),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('yourSystem')), segmented(PRESET_SYSTEMS.map((x) => ({ value: x.id, label: x.name })), sys, (v) => { sys = v; })),
  );
  const close = modal({
    title: t('welcome'), body,
    actions: [{ label: t('letsGo'), kind: 'primary', onClick: () => {
      Object.assign(state.settings, { myRole: role, mySystem: sys, onboarded: true, focus: role ? 'mixed' : 'all' });
      persist('settings'); renderChrome(); route();
    } }],
  });
}

async function route() {
  const [, name = 'field', ...rest] = (location.hash || '#/field').split('/');
  const id = VIEWS[name] ? name : 'field';
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('on', a.dataset.nav === (NAV_PARENT[id] || id)));
  try { current?.destroy?.(); } catch { /* ignore */ }
  const root = clear($('#view'));
  root.dataset.view = id;
  try {
    const mod = await VIEWS[id]();
    current = mod.default;
    await current.render(root, rest);
  } catch (e) {
    console.error(e);
    root.append(h('div', { class: 'card error' }, 'Fehler: ' + e.message));
  }
  window.scrollTo(0, 0);
}
export const go = (path) => { if (location.hash === '#/' + path) route(); else location.hash = '#/' + path; };
export const refresh = () => { renderChrome(); route(); };

async function main() {
  window.RP = { rolePicker, refresh, go };
  await loadState();
  setLang(state.settings.lang);
  bindSettings(state.settings);
  applyTheme();
  renderChrome();
  window.addEventListener('hashchange', route);
  await route();
  if (!state.settings.onboarded) onboarding();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            modal({ title: t('updateReady'), body: '', actions: [{ label: t('cancel') }, { label: t('reload'), kind: 'primary', onClick: () => location.reload() }] });
          }
        });
      });
    }).catch(() => {});
  }
  document.body.classList.add('ready');
}
main();
