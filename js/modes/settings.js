// Einstellungen: Sprache, Design, Regeln, Übungsfokus, Daten
import { t, addStrings, setLang } from '../i18n.js';
import { h, clear, segmented, toggle, toast, confirmDialog, field } from '../ui/dom.js';
import { state, persist, exportData, importData, DEFAULT_SETTINGS } from '../ui/store.js';

addStrings({
  de: {
    'set.title': 'Einstellungen', 'set.lang': 'Sprache', 'set.theme': 'Darstellung', 'set.dark': 'Nacht', 'set.light': 'Tag',
    'set.feedback': 'Feedback', 'set.sound': 'Töne', 'set.haptics': 'Vibration (Haptik)',
    'set.rules': 'Regeln', 'set.liberoServe': 'Hobbyregel: Libero darf aufschlagen', 'set.liberoFront': 'Hobbyregel: Libero darf vorne spielen',
    'set.overlap': 'Überlappungsprüfung aktiv', 'set.focus': 'Übungsfokus', 'set.mix': 'Gemischt: {n} % eigene Rolle',
    'set.role': 'Meine Rolle', 'set.changeRole': 'Rolle und System ändern',
    'set.data': 'Daten', 'set.export': 'Daten exportieren', 'set.import': 'Daten importieren', 'set.imported': 'Daten importiert',
    'set.importFail': 'Datei konnte nicht gelesen werden.', 'set.resetStats': 'Statistik und Fortschritt zurücksetzen', 'set.resetAll': 'Alles zurücksetzen',
    'set.resetDone': 'Zurückgesetzt', 'set.install': 'App installieren', 'set.installHint': 'Im Browser-Menü „Zum Startbildschirm hinzufügen" wählen.',
    'set.offline': 'Alles wird lokal auf diesem Gerät gespeichert und funktioniert offline.',
  },
  en: {
    'set.title': 'Settings', 'set.lang': 'Language', 'set.theme': 'Appearance', 'set.dark': 'Night', 'set.light': 'Day',
    'set.feedback': 'Feedback', 'set.sound': 'Sounds', 'set.haptics': 'Vibration (haptics)',
    'set.rules': 'Rules', 'set.liberoServe': 'Recreational rule: libero may serve', 'set.liberoFront': 'Recreational rule: libero may play front row',
    'set.overlap': 'Overlap check on', 'set.focus': 'Practice focus', 'set.mix': 'Mixed: {n} % your role',
    'set.role': 'My role', 'set.changeRole': 'Change role and system',
    'set.data': 'Data', 'set.export': 'Export data', 'set.import': 'Import data', 'set.imported': 'Data imported',
    'set.importFail': 'Could not read the file.', 'set.resetStats': 'Reset stats and progress', 'set.resetAll': 'Reset everything',
    'set.resetDone': 'Reset done', 'set.install': 'Install app', 'set.installHint': 'Choose "Add to Home Screen" in your browser menu.',
    'set.offline': 'Everything is stored locally on this device and works offline.',
  },
});

function draw(root) {
  clear(root);
  const S = state.settings;
  const save = () => persist('settings');
  const mixLabel = h('span', { class: 'field-label' }, t('set.mix', { n: S.mix }));
  root.append(
    h('h1', {}, t('set.title')),
    h('section', { class: 'card' },
      field(t('set.lang'), segmented([{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }], S.lang, (v) => { S.lang = v; setLang(v); save(); window.RP.refresh(); })),
      field(t('set.theme'), segmented([{ value: 'dark', label: t('set.dark') }, { value: 'light', label: t('set.light') }], S.theme, (v) => { S.theme = v; save(); window.RP.refresh(); document.documentElement.dataset.theme = v; })),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('set.role')),
        h('button', { class: 'btn small', onclick: () => window.RP.rolePicker(() => draw(root)) }, t('set.changeRole') + ': ' + (S.myRole ? t('role.' + S.myRole) : t('coach')))),
    ),
    h('section', { class: 'card' }, h('h2', {}, t('set.feedback')),
      h('div', { class: 'toggles' },
        toggle(t('set.sound'), S.sound, (v) => { S.sound = v; save(); }),
        toggle(t('set.haptics'), S.haptics, (v) => { S.haptics = v; save(); }))),
    h('section', { class: 'card' }, h('h2', {}, t('set.rules')),
      h('div', { class: 'toggles' },
        toggle(t('set.liberoServe'), S.rules.liberoServe, (v) => { S.rules.liberoServe = v; save(); }),
        toggle(t('set.liberoFront'), S.rules.liberoFront, (v) => { S.rules.liberoFront = v; save(); }),
        toggle(t('set.overlap'), S.rules.overlap !== false, (v) => { S.rules.overlap = v; save(); }))),
    h('section', { class: 'card' }, h('h2', {}, t('set.focus')),
      segmented(['mine', 'all', 'mixed'].map((f) => ({ value: f, label: t('focus.' + f) })), S.focus, (v) => { S.focus = v; save(); }),
      h('div', { class: 'field', style: { marginTop: '14px' } }, mixLabel,
        h('input', { type: 'range', min: 10, max: 90, step: 10, value: S.mix, 'aria-label': t('set.mix', { n: S.mix }), oninput: (e) => { S.mix = +e.target.value; mixLabel.textContent = t('set.mix', { n: S.mix }); save(); } }))),
    h('section', { class: 'card' }, h('h2', {}, t('set.data')), h('p', { class: 'muted' }, t('set.offline')),
      h('div', { class: 'btn-row' },
        window.RP?.installPrompt ? h('button', { class: 'btn small primary', onclick: async () => { window.RP.installPrompt.prompt(); window.RP.installPrompt = null; } }, t('set.install')) : null,
        h('button', { class: 'btn small', onclick: () => {
          const blob = new Blob([exportData()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `rotationpro-${new Date().toISOString().slice(0, 10)}.json` });
          document.body.append(a); a.click(); a.remove();
        } }, t('set.export')),
        h('label', { class: 'btn small' }, t('set.import'), h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
          try { importData(await e.target.files[0].text()); toast(t('set.imported'), 'ok'); setLang(state.settings.lang); window.RP.refresh(); } catch { toast(t('set.importFail'), 'err'); }
        } }))),
      h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        h('button', { class: 'btn small danger', onclick: () => confirmDialog(t('set.resetStats') + '?', () => {
          state.events = []; state.srs = []; state.progress = {}; state.game = { xp: 0, highscores: {}, daily: {}, bestStreak: 0, played: 0 };
          ['events', 'srs', 'progress', 'game'].forEach(persist); toast(t('set.resetDone'), 'ok');
        }, t('set.resetStats')) }, t('set.resetStats')),
        h('button', { class: 'btn small danger', onclick: () => confirmDialog(t('set.resetAll') + '?', async () => {
          try { indexedDB.deleteDatabase('rotationpro'); } catch { /* ignore */ }
          Object.keys(localStorage).filter((k) => k.startsWith('rp_')).forEach((k) => localStorage.removeItem(k));
          state.settings = { ...DEFAULT_SETTINGS }; location.reload();
        }, t('set.resetAll')) }, t('set.resetAll')))),
  );
}

export default { render: draw };
