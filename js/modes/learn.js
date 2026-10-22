// Lernmodus: interaktive Lektionen mit Schritt-für-Schritt-Animation
import { t, addStrings, getLang } from '../i18n.js';
import { h, clear, segmented, haptic, toast } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { Court } from '../ui/court.js';
import { state, persist } from '../ui/store.js';
import { buildLessons, scene, stepText } from '../engine/lessons.js';
import { overlapForPhase } from '../engine/formation.js';
import { formationPlayers, runArrows, overlapMessages } from '../ui/render.js';

addStrings({
  de: {
    'ln.title': 'Lernen', 'ln.general': 'Grundlagen', 'ln.system': 'Systeme', 'ln.role': 'Rollen', 'ln.steps': '{n} Schritte', 'ln.start': 'Starten', 'ln.continue': 'Weiter lernen',
    'ln.again': 'Wiederholen', 'ln.step': 'Schritt {i} von {n}', 'ln.play': 'Abspielen', 'ln.pause': 'Pause', 'ln.done': 'Lektion abgeschlossen', 'ln.toList': 'Zur Übersicht',
    'ln.noRole': 'Wähle zuerst deine Rolle, um „Meine Position" zu nutzen.', 'ln.quizThis': 'Dazu Quiz starten', 'ln.empty': 'Keine Lektionen für diesen Fokus.',
    'ln.phaseHint': 'Tippe eine Phase an, um deine Position darin zu sehen.',
  },
  en: {
    'ln.title': 'Learn', 'ln.general': 'Basics', 'ln.system': 'Systems', 'ln.role': 'Roles', 'ln.steps': '{n} steps', 'ln.start': 'Start', 'ln.continue': 'Continue',
    'ln.again': 'Review', 'ln.step': 'Step {i} of {n}', 'ln.play': 'Play', 'ln.pause': 'Pause', 'ln.done': 'Lesson complete', 'ln.toList': 'Back to overview',
    'ln.noRole': 'Choose your role first to use "My position".', 'ln.quizThis': 'Start a quiz on this', 'ln.empty': 'No lessons for this focus.',
    'ln.phaseHint': 'Tap a phase to see your position in it.',
  },
});

let root, timer = null;
const prog = (id) => (state.progress[id] = state.progress[id] || { seen: [], done: false });

function filtered(focus) {
  const all = buildLessons(state.settings.mySystem);
  const role = state.settings.myRole;
  if (focus === 'all' || !role) return all;
  const mine = (l) => l.tags.includes(role);
  if (focus === 'mine') return all.filter(mine);
  return [...all.filter(mine), ...all.filter((l) => !mine(l))];
}

function list() {
  stop();
  clear(root);
  const L = getLang();
  root.append(h('h1', {}, t('ln.title')),
    segmented(['mine', 'all', 'mixed'].map((f) => ({ value: f, label: t('focus.' + f) })), state.settings.focus, (v) => {
      if (v === 'mine' && !state.settings.myRole) { toast(t('ln.noRole')); window.RP.rolePicker(); return; }
      state.settings.focus = v; persist('settings'); list();
    }));
  const lessons = filtered(state.settings.focus);
  if (!lessons.length) root.append(h('p', { class: 'empty' }, t('ln.empty')));
  const groups = [['role', t('ln.role')], ['general', t('ln.general')], ['system', t('ln.system')]];
  for (const [kind, label] of groups) {
    const ls = lessons.filter((l) => l.kind === kind);
    if (!ls.length) continue;
    root.append(h('div', { class: 'section-title' }, h('h2', {}, label)));
    const box = h('div', { class: 'list' });
    for (const l of ls) {
      const p = prog(l.id);
      const pct = Math.round((p.seen.length / l.steps.length) * 100);
      const mine = l.tags.includes(state.settings.myRole);
      box.append(h('button', { class: 'row-item lesson-row' + (mine ? ' mine' : ''), onclick: () => play(l, p.done ? 0 : Math.min(firstUnseen(l, p), l.steps.length - 1)) },
        h('span', { class: 'lesson-mark ' + (l.tags[0] ? 'r-' + l.tags[0] : 'r-U') }),
        h('span', { class: 'grow' }, h('span', { class: 'title' }, l.title[L]), h('span', { class: 'sub' }, t('ln.steps', { n: l.steps.length })),
          h('span', { class: 'progress' }, h('span', { style: { width: pct + '%' } }))),
        h('span', { class: 'chip' + (p.done ? ' on-chip' : '') }, p.done ? t('ln.again') : pct ? t('ln.continue') : t('ln.start'))));
    }
    root.append(box);
  }
}
const firstUnseen = (l, p) => { for (let i = 0; i < l.steps.length; i++) if (!p.seen.includes(i)) return i; return 0; };

function stop() { clearInterval(timer); timer = null; }

function play(lesson, startIdx = 0) {
  stop();
  clear(root);
  const L = getLang();
  let i = startIdx;
  let phase = null;
  const court = new Court({ interactive: false });
  const title = h('h1', { class: 'lesson-title' }, lesson.title[L]);
  const stepLbl = h('div', { class: 'muted' });
  const bar = h('div', { class: 'progress' }, h('span'));
  const phaseBox = h('div', { class: 'phase-bar' });
  const text = h('p', { class: 'lesson-text', 'aria-live': 'polite' });
  const extra = h('div', { class: 'msgs' });
  const playBtn = h('button', { class: 'btn ghost', onclick: () => toggle() });
  const prevBtn = h('button', { class: 'btn ghost', onclick: () => go(i - 1), 'aria-label': t('back') }, icon('rotateBack'), t('back'));
  const nextBtn = h('button', { class: 'btn primary', onclick: () => go(i + 1) });
  root.append(
    h('button', { class: 'link', onclick: list }, '‹ ' + t('ln.toList')), title, stepLbl, bar,
    h('div', { class: 'court-wrap lesson-court' }, court.el), phaseBox, text, extra,
    h('div', { class: 'rot-row' }, prevBtn, playBtn, nextBtn));

  const draw = () => {
    const st = lesson.steps[i];
    const ph = st.phases ? (phase || st.phase) : st.phase;
    const sc = scene({ systemId: st.sys, rot: st.rot, phase: ph, role: st.role || null });
    const entries = sc.f.entries.map((e) => (st.illegal?.[e.zone] ? { ...e, ...st.illegal[e.zone] } : e));
    const errs = overlapForPhase(entries, ph);
    const errZones = errs.flatMap((e) => [e.a, e.b]);
    court.setPlayers(formationPlayers({ entries }, sc.sq.players, { mineId: sc.mineId, errorZones: errZones, showRoleLabel: false }));
    court.highlightZones(st.highlight || [], 'hl');
    court.setOverlay(st.arrows === 'all' ? runArrows(sc.f) : st.arrows === 'mine' && sc.mineId ? runArrows(sc.f, { onlyId: sc.mineId }) : []);
    clear(phaseBox);
    if (st.phases) {
      phaseBox.append(segmented(st.phases.map((p) => ({ value: p, label: t('phase.' + p) })), ph, (v) => { phase = v; draw(); }, 'scroll'));
    }
    const head = `R${st.rot} · ${t('phase.' + ph)}`;
    text.textContent = stepText(st, ph, L);
    clear(extra);
    extra.append(h('div', { class: 'msg hint' }, head + (st.phases ? ' – ' + t('ln.phaseHint') : '')));
    if (errs.length) overlapMessages(errs, entries, sc.sq.players).forEach((m) => extra.append(h('div', { class: 'msg err' }, m)));
    stepLbl.textContent = t('ln.step', { i: i + 1, n: lesson.steps.length });
    bar.firstChild.style.width = ((i + 1) / lesson.steps.length) * 100 + '%';
    prevBtn.disabled = i === 0;
    clear(nextBtn).append(i === lesson.steps.length - 1 ? t('done') : t('next'));
    clear(playBtn).append(icon(timer ? 'pause' : 'rotate'), timer ? t('ln.pause') : t('ln.play'));
    const p = prog(lesson.id);
    if (!p.seen.includes(i)) { p.seen.push(i); persist('progress'); }
  };
  const go = (n) => {
    if (n < 0) return;
    if (n >= lesson.steps.length) { finish(); return; }
    i = n; phase = null; haptic(8); draw();
  };
  const toggle = () => {
    if (timer) { stop(); draw(); return; }
    timer = setInterval(() => {
      const st = lesson.steps[i];
      if (st.phases) {
        const k = st.phases.indexOf(phase || st.phase);
        if (k < st.phases.length - 1) { phase = st.phases[k + 1]; draw(); return; }
      }
      if (i >= lesson.steps.length - 1) { stop(); draw(); return; }
      i++; phase = null; draw();
    }, 3200);
    draw();
  };
  const finish = () => {
    stop();
    const p = prog(lesson.id); p.done = true; persist('progress');
    haptic([10, 40, 10]);
    clear(root).append(h('div', { class: 'card done-card' },
      h('h1', {}, t('ln.done')), h('p', {}, lesson.title[L]),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: list }, t('ln.toList')),
        h('button', { class: 'btn primary', onclick: () => { location.hash = '#/quiz/' + (lesson.tags[0] || 'all'); } }, t('ln.quizThis')))));
  };
  draw();
}

export default {
  render(r, params = []) {
    root = r;
    const id = params[0];
    const l = id && buildLessons(state.settings.mySystem).find((x) => x.id === id);
    if (l) play(l); else list();
  },
  destroy: stop,
};
