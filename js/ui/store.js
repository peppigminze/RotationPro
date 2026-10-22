// Persistenz: IndexedDB (Key-Value), Fallback localStorage. Gesamter Zustand liegt im Speicher (state).
import { demoSquad, getSystem, autoLineup } from '../engine/systems.js';
import { rotate } from '../engine/core.js';
import { uid } from './dom.js';

const DB_NAME = 'rotationpro', STORE = 'kv', KEYS = ['settings', 'teams', 'activeTeam', 'customSystems', 'progress', 'events', 'srs', 'game', 'boards'];
let db = null;

function openDb() {
  return new Promise((res) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    } catch { res(null); }
  });
}
function idbGet(key) {
  return new Promise((res) => {
    try { const r = db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch { res(undefined); }
  });
}
function idbSet(key, val) {
  return new Promise((res) => {
    try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch { res(false); }
  });
}

export const DEFAULT_SETTINGS = {
  lang: (navigator.language || 'de').startsWith('en') ? 'en' : 'de',
  theme: 'dark', myRole: null, mySystem: '5-1', focus: 'mixed', mix: 70,
  sound: true, haptics: true, onboarded: false,
  rules: { liberoServe: false, liberoFront: false, overlap: true },
};

export const state = {
  settings: { ...DEFAULT_SETTINGS }, teams: [], activeTeam: null, customSystems: [],
  progress: {}, events: [], srs: [], game: { xp: 0, highscores: {}, daily: {}, bestStreak: 0, played: 0 }, boards: [],
};

const timers = {};
export function persist(key) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    const val = JSON.parse(JSON.stringify(state[key]));
    if (db) idbSet(key, val); else try { localStorage.setItem('rp_' + key, JSON.stringify(val)); } catch { /* voll */ }
  }, 150);
}
export const persistAll = () => KEYS.forEach(persist);

export async function loadState() {
  db = await openDb();
  for (const k of KEYS) {
    let v;
    if (db) v = await idbGet(k);
    if (v === undefined) { try { const raw = localStorage.getItem('rp_' + k); if (raw) v = JSON.parse(raw); } catch { /* ignore */ } }
    if (v !== undefined && v !== null) state[k] = k === 'settings' ? { ...DEFAULT_SETTINGS, ...v, rules: { ...DEFAULT_SETTINGS.rules, ...(v.rules || {}) } } : v;
  }
  if (!state.teams.length) { const tm = createDemoTeam(); state.teams.push(tm); state.activeTeam = tm.id; persist('teams'); persist('activeTeam'); }
  if (!state.teams.find((x) => x.id === state.activeTeam)) state.activeTeam = state.teams[0].id;
  return state;
}

const DEMO_NAMES = { S: ['Lea', 'Noa'], OH: ['Luca', 'Mia'], MB: ['Jan', 'Sara'], OPP: ['Elia'], L: ['Nina', 'Tim'], U: ['Alex', 'Kim', 'Robin', 'Sam', 'Jo', 'Mika'] };

export function createDemoTeam(systemId = '5-1', name = 'Mein Team') {
  const sys = getSystem(systemId, state.customSystems);
  const sq = demoSquad(sys);
  const map = {};
  const players = sq.list.map((p) => {
    const id = uid('p'); map[p.id] = id;
    return { id, name: DEMO_NAMES[p.role]?.[p.idx - 1] || `Spieler ${p.number}`, number: p.number, role: p.role, gender: '' };
  });
  const team = { id: uid('t'), name, systemId: sys.id, players, lineups: [] };
  team.lineups.push({ id: uid('l'), name: 'Start', systemId: sys.id, start: sq.lineup.map((x) => map[x]), liberos: sq.liberos.map((x) => map[x]), liberoMode: 'single', rot: 0, myPlayer: null });
  team.activeLineup = team.lineups[0].id;
  return team;
}

export const activeTeam = () => state.teams.find((x) => x.id === state.activeTeam) || state.teams[0];
export const activeLineup = (team = activeTeam()) => team.lineups.find((l) => l.id === team.activeLineup) || team.lineups[0];
export const playersMap = (team = activeTeam()) => Object.fromEntries(team.players.map((p) => [p.id, p]));
export const currentLineup = (l) => rotate(l.start, l.rot || 0);
export function setCurrentLineup(l, cur) { l.start = rotate(cur, -(l.rot || 0)); }
export const systemById = (id) => getSystem(id, state.customSystems);

export function newLineup(team, name, systemId) {
  const sys = systemById(systemId || team.systemId);
  const { lineup, liberos } = autoLineup(team.players, sys);
  const l = { id: uid('l'), name, systemId: sys.id, start: lineup, liberos, liberoMode: 'single', rot: 0, myPlayer: null };
  team.lineups.push(l); team.activeLineup = l.id;
  return l;
}

/** Eigener Spieler: explizit gewählt oder erster Spieler mit der eigenen Rolle. */
export function myPlayerId(team = activeTeam(), l = activeLineup(team)) {
  if (l?.myPlayer && team.players.some((p) => p.id === l.myPlayer)) return l.myPlayer;
  const role = state.settings.myRole;
  if (!role) return null;
  const onCourt = [...(l?.start || []), ...(l?.liberos || [])];
  const p = team.players.find((x) => x.role === role && onCourt.includes(x.id)) || team.players.find((x) => x.role === role);
  return p?.id || null;
}

export function exportData() { return JSON.stringify({ app: 'RotationPro', v: 1, ...Object.fromEntries(KEYS.map((k) => [k, state[k]])) }, null, 1); }
export function importData(json) {
  const d = JSON.parse(json);
  if (d.app !== 'RotationPro') throw new Error('format');
  for (const k of KEYS) if (d[k] !== undefined) state[k] = d[k];
  persistAll();
}

/** Effektive Regeln: Einstellungen + Hobby-Optionen des Systems ("vereinfachte Regeln" erlaubt Libero vorne/Aufschlag). */
export function effectiveRules(sys) {
  const r = { ...state.settings.rules };
  if (sys?.hobby?.simplified) { r.liberoServe = true; r.liberoFront = true; }
  return r;
}
