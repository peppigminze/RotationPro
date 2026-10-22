// Spaced Repetition (Leitner-Boxen): falsch beantwortete Fragen kommen wieder
const MIN = 60e3, DAY = 864e5;
export const INTERVALS = [0.5 * MIN, 10 * MIN, DAY, 3 * DAY, 7 * DAY]; // Box 1..5

/** Ergebnis verbuchen. items: [{key, type, params, box, due, wrong}] → neue Liste */
export function review(items, q, correct, now = Date.now()) {
  const list = items.slice();
  const i = list.findIndex((x) => x.key === q.key);
  if (!correct) {
    const it = i >= 0 ? { ...list[i] } : { key: q.key, type: q.type, params: q.params, wrong: 0, roles: q.tags?.roles || [] };
    it.box = 1; it.due = now + INTERVALS[0]; it.wrong = (it.wrong || 0) + 1;
    if (i >= 0) list[i] = it; else list.push(it);
    return list.slice(-200);
  }
  if (i < 0) return list;
  const it = { ...list[i], box: list[i].box + 1 };
  if (it.box > INTERVALS.length) { list.splice(i, 1); return list; }
  it.due = now + INTERVALS[it.box - 1];
  list[i] = it;
  return list;
}

/** Fällige Wiederholungen (optional nur für eine Rolle) */
export function due(items, now = Date.now(), role = null) {
  return items.filter((x) => x.due <= now && (!role || (x.roles || []).includes(role))).sort((a, b) => a.due - b.due);
}
