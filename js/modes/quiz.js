// Quiz: regelbasierte Fragen, Übungsfokus, Schwierigkeit, Spaced Repetition
import { t, addStrings, getLang } from '../i18n.js';
import { h, clear, segmented, haptic, sound, fmtPct, fmtMs } from '../ui/dom.js';
import { Court } from '../ui/court.js';
import { state, persist } from '../ui/store.js';
import { nextQuestion, generate } from '../engine/questions.js';
import { review, due } from '../engine/srs.js';
import { drawQuestion } from '../ui/qvisual.js';

addStrings({
  de: {
    'qz.title': 'Quiz', 'qz.focus': 'Fokus', 'qz.diff': 'Schwierigkeit', 'qz.easy': 'Leicht', 'qz.medium': 'Mittel', 'qz.hard': 'Schwer', 'qz.len': 'Fragen',
    'qz.due': '{n} Wiederholung(en) fällig – sie werden eingestreut.', 'qz.start': 'Quiz starten', 'qz.q': 'Frage {i} von {n}', 'qz.right': 'Richtig!', 'qz.wrong': 'Leider falsch.',
    'qz.next': 'Nächste Frage', 'qz.finish': 'Auswertung', 'qz.result': 'Auswertung', 'qz.score': '{ok} von {n} richtig', 'qz.avg': 'Ø Antwortzeit',
    'qz.again': 'Neues Quiz', 'qz.repeatWrong': 'Fehler wiederholen', 'qz.repeatInfo': 'Falsch beantwortete Fragen kommen später wieder (Spaced Repetition).',
    'qz.byRole': 'Nach Rolle', 'qz.review': 'Wiederholung', 'qz.tapCourt': 'Tippe auf dem Feld den richtigen Buchstaben an.', 'qz.target': 'Gezieltes Training',
    'qz.mix': '{n} % eigene Rolle', 'qz.mineTag': 'Deine Rolle', 'qz.mixSet': 'Verhältnis',
  },
  en: {
    'qz.title': 'Quiz', 'qz.focus': 'Focus', 'qz.diff': 'Difficulty', 'qz.easy': 'Easy', 'qz.medium': 'Medium', 'qz.hard': 'Hard', 'qz.len': 'Questions',
    'qz.due': '{n} review(s) due – they will be mixed in.', 'qz.start': 'Start quiz', 'qz.q': 'Question {i} of {n}', 'qz.right': 'Correct!', 'qz.wrong': 'Not quite.',
    'qz.next': 'Next question', 'qz.finish': 'Results', 'qz.result': 'Results', 'qz.score': '{ok} of {n} correct', 'qz.avg': 'Avg. answer time',
    'qz.again': 'New quiz', 'qz.repeatWrong': 'Repeat mistakes', 'qz.repeatInfo': 'Missed questions come back later (spaced repetition).',
    'qz.byRole': 'By role', 'qz.review': 'Review', 'qz.tapCourt': 'Tap the right letter on the court.', 'qz.target': 'Targeted training',
    'qz.mix': '{n} % your role', 'qz.mineTag': 'Your role', 'qz.mixSet': 'Ratio',
  },
});

let root, cfg = { difficulty: 'medium', len: 10 };

export function logEvent(q, ok, ms, src, chosen) {
  const opt = q.options.find((o) => o.id === chosen);
  state.events.push({ ts: Date.now(), src, focus: state.settings.focus, mine: q.isMine ?? false, role: q.focusRole && q.tags.roles.includes(q.focusRole) ? q.focusRole : q.tags.roles[0], rot: q.tags.rot || 0, phase: q.tags.phase, type: q.type, ok, ms, confused: !ok && opt?.origin ? opt.origin : undefined });
  if (state.events.length > 4000) state.events = state.events.slice(-4000);
  persist('events');
}

function setup(preset) {
  clear(root);
  const S = state.settings;
  const dueN = due(state.srs).length;
  const mixLbl = h('span', { class: 'field-label' }, t('qz.mix', { n: S.mix }));
  const mixBox = h('div', { class: 'field', style: { display: S.focus === 'mixed' ? '' : 'none', marginTop: '10px' } }, mixLbl,
    h('input', { type: 'range', min: 10, max: 90, step: 10, value: S.mix, 'aria-label': t('qz.mixSet'), oninput: (e) => { S.mix = +e.target.value; mixLbl.textContent = t('qz.mix', { n: S.mix }); persist('settings'); } }));
  root.append(h('h1', {}, t('qz.title')));
  if (preset) root.append(h('div', { class: 'msg info' }, t('qz.target')));
  root.append(
    h('section', { class: 'card' },
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('qz.focus')),
        segmented(['mine', 'all', 'mixed'].map((f) => ({ value: f, label: t('focus.' + f) })), S.focus, (v) => {
          if (v === 'mine' && !S.myRole) { window.RP.rolePicker(() => setup(preset)); return; }
          S.focus = v; persist('settings'); mixBox.style.display = v === 'mixed' ? '' : 'none';
        }), mixBox),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('qz.diff')),
        segmented(['easy', 'medium', 'hard'].map((d) => ({ value: d, label: t('qz.' + d) })), cfg.difficulty, (v) => { cfg.difficulty = v; })),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('qz.len')),
        segmented([5, 10, 20].map((n) => ({ value: n, label: String(n) })), cfg.len, (v) => { cfg.len = v; })),
      dueN ? h('div', { class: 'msg lib' }, t('qz.due', { n: dueN })) : null,
      h('button', { class: 'btn primary big', style: { width: '100%', marginTop: '8px' }, onclick: () => run(preset) }, t('qz.start'))));
}

function makeQ(preset, i) {
  const S = state.settings;
  const focusRole = S.focus === 'mine' ? S.myRole : null;
  const d = due(state.srs, Date.now(), focusRole);
  if (!preset && d.length && i % 2 === 1) {
    const it = d[0];
    const q = generate(it.type, it.params);
    q.isReview = true; q.focusRole = it.roles?.[0]; q.isMine = !!S.myRole && q.tags.roles.includes(S.myRole);
    return q;
  }
  return nextQuestion({ focus: S.focus, myRole: S.myRole, mix: S.mix, difficulty: cfg.difficulty, systemId: S.mySystem, ...(preset || {}) });
}

function run(preset, fixed) {
  const L = getLang();
  const n = fixed ? fixed.length : cfg.len;
  const results = [];
  let i = 0, q, t0, answered;
  const court = new Court({ interactive: true, draggable: false, mode: 'static' });
  court.o.mode = 'static';
  const head = h('div', { class: 'quiz-head' });
  const bar = h('div', { class: 'progress' }, h('span'));
  const prompt = h('h2', { class: 'q-prompt' });
  const courtBox = h('div', { class: 'court-wrap q-court' }, court.el);
  const opts = h('div', { class: 'q-opts' });
  const fb = h('div', { class: 'q-fb', 'aria-live': 'polite' });
  clear(root).append(head, bar, prompt, courtBox, opts, fb);

  const show = () => {
    q = fixed ? Object.assign(generate(fixed[i].type, fixed[i].params), { focusRole: fixed[i].roles?.[0], isReview: true }) : makeQ(preset, i);
    answered = false;
    clear(head).append(...[h('span', {}, t('qz.q', { i: i + 1, n })), q.isReview && h('span', { class: 'chip rev-chip' }, t('qz.review')), q.isMine && h('span', { class: 'chip me-chip' }, t('qz.mineTag'))].filter(Boolean));
    bar.firstChild.style.width = (i / n) * 100 + '%';
    prompt.textContent = q.prompt[L];
    courtBox.style.display = drawQuestion(court, q, { onMarker: (id) => answer(id) }) ? '' : 'none';
    clear(opts); clear(fb);
    if (q.answerMode === 'court') opts.append(h('p', { class: 'muted' }, t('qz.tapCourt')));
    for (const o of q.options) {
      opts.append(h('button', { class: 'btn q-opt' + (o.pt ? ' letter' : ''), 'data-oid': o.id, onclick: () => answer(o.id) }, o.label[L]));
    }
    t0 = performance.now();
  };
  const answer = (id) => {
    if (answered) return; answered = true;
    const ms = Math.round(performance.now() - t0);
    const ok = !!q.options.find((o) => o.id === id)?.correct;
    results.push({ q, ok, ms });
    logEvent(q, ok, ms, 'quiz', id);
    state.srs = review(state.srs, q, ok); persist('srs');
    ok ? (sound.ok(), haptic(15)) : (sound.fail(), haptic([30, 40, 30]));
    opts.querySelectorAll('.q-opt').forEach((b) => {
      const o = q.options.find((x) => x.id === b.dataset.oid);
      b.disabled = true;
      if (o.correct) b.classList.add('right'); else if (o.id === id) b.classList.add('wrong');
    });
    drawQuestion(court, q, { reveal: { chosenId: id } });
    clear(fb).append(
      h('div', { class: 'msg ' + (ok ? 'ok' : 'err') }, h('strong', {}, ok ? t('qz.right') : t('qz.wrong')), ' ', q.explanation[L]),
      h('button', { class: 'btn primary', style: { width: '100%' }, onclick: () => { i++; if (i >= n) end(); else show(); } }, i + 1 >= n ? t('qz.finish') : t('qz.next')));
    fb.querySelector('.btn').focus();
  };
  const end = () => {
    const ok = results.filter((r) => r.ok).length;
    const avg = results.reduce((a, r) => a + r.ms, 0) / results.length;
    const byRole = {};
    results.forEach((r) => { const k = r.q.tags.roles[0]; byRole[k] = byRole[k] || { n: 0, ok: 0 }; byRole[k].n++; if (r.ok) byRole[k].ok++; });
    const wrong = results.filter((r) => !r.ok).map((r) => ({ type: r.q.type, params: r.q.params, roles: r.q.tags.roles }));
    if (ok === n) sound.level();
    clear(root).append(h('div', { class: 'card result-card' },
      h('h1', {}, t('qz.result')),
      h('div', { class: 'big-score' }, `${ok}/${n}`),
      h('p', {}, t('qz.score', { ok, n }) + ' – ' + fmtPct(ok / n)),
      h('p', { class: 'muted' }, t('qz.avg') + ': ' + fmtMs(avg)),
      h('h3', {}, t('qz.byRole')),
      h('div', { class: 'sys-roles' }, Object.entries(byRole).map(([r, v]) => h('span', { class: 'mini-role r-' + r }, `${t('role.' + r)}: ${v.ok}/${v.n}`))),
      wrong.length ? h('p', { class: 'muted', style: { marginTop: '12px' } }, t('qz.repeatInfo')) : null,
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        wrong.length ? h('button', { class: 'btn', onclick: () => run(null, wrong) }, t('qz.repeatWrong')) : null,
        h('button', { class: 'btn primary', onclick: () => setup(preset) }, t('qz.again')))));
  };
  show();
}

export default {
  render(r, params = []) {
    root = r;
    let preset = window.RP?.pendingQuiz || null;
    if (window.RP) window.RP.pendingQuiz = null;
    if (!preset && params[0] && ['S', 'OH', 'MB', 'OPP', 'L'].includes(params[0])) preset = { roleFilter: params[0] };
    setup(preset);
  },
};
