// Spielfeld als SVG. Einheiten = Meter. Netz oben (y = 0), Grundlinie unten (y = 9).
import { s, h, haptic } from './dom.js';
import { ZONE_XY } from '../engine/core.js';
import { t } from '../i18n.js';

const VB = { x: -1.3, y: -1.5, w: 11.6, h: 12.6 };
const R = 0.62;

export const nearestZone = (x, y) => {
  if (x < -0.6 || x > 9.6 || y < -0.2 || y > 10.6) return 0;
  let best = 0, d = Infinity;
  for (const [z, p] of Object.entries(ZONE_XY)) { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < d) { d = dd; best = +z; } }
  return best;
};

export class Court {
  constructor(opts = {}) {
    this.o = { mode: 'zones', showZones: true, interactive: true, ...opts };
    this.nodes = new Map();
    this.el = s('svg', { class: 'court' + (this.o.small ? ' small' : ''), viewBox: `${VB.x} ${VB.y} ${VB.w} ${VB.h}`, role: 'img', 'aria-label': t('nav.field') });
    this.build();
    if (this.o.interactive) this.bind();
  }

  build() {
    const g = s('g', { class: 'court-base' });
    g.append(
      s('rect', { x: VB.x, y: VB.y, width: VB.w, height: VB.h, class: 'c-free', rx: 0.3 }),
      s('rect', { x: -0.5, y: VB.y, width: 10, height: -VB.y, class: 'c-opp' }),
      s('text', { x: 4.5, y: -0.75, class: 'c-opp-label', 'text-anchor': 'middle' }, this.o.oppLabel || ''),
      s('rect', { x: 0, y: 0, width: 9, height: 9, class: 'c-floor' }),
      s('rect', { x: 0, y: 0, width: 9, height: 3, class: 'c-front' }),
      s('line', { x1: 0, y1: 3, x2: 9, y2: 3, class: 'c-line' }),
      s('rect', { x: 0, y: 0, width: 9, height: 9, class: 'c-line c-outline' }),
    );
    // Zonen-Raster (gestrichelt) und Zonennummern
    this.zoneLayer = s('g', { class: 'zones' });
    if (this.o.showZones) {
      g.append(s('line', { x1: 3, y1: 0, x2: 3, y2: 9, class: 'c-grid' }), s('line', { x1: 6, y1: 0, x2: 6, y2: 9, class: 'c-grid' }));
      for (const [z, p] of Object.entries(ZONE_XY)) {
        const front = +z >= 2 && +z <= 4;
        this.zoneLayer.append(s('rect', { class: 'zone-hit', 'data-zone': z, x: (+z === 4 || +z === 5 ? 0 : +z === 3 || +z === 6 ? 3 : 6), y: front ? 0 : 3.9, width: 3, height: front ? 3.9 : 5.1 }));
        const zx = (+z === 4 || +z === 5 ? 0 : +z === 3 || +z === 6 ? 3 : 6);
        this.zoneLayer.append(s('text', { x: zx + 2.75, y: front ? 3.75 : 8.75, class: 'zone-num', 'text-anchor': 'end' }, z));
      }
    }
    // Netz
    g.append(
      s('rect', { x: -0.6, y: -0.13, width: 10.2, height: 0.26, class: 'c-net' }),
      s('circle', { cx: -0.6, cy: 0, r: 0.17, class: 'c-post' }), s('circle', { cx: 9.6, cy: 0, r: 0.17, class: 'c-post' }),
      s('text', { x: 9.75, y: 0.15, class: 'c-net-label', 'text-anchor': 'start', transform: 'rotate(90 9.75 0.15)' }, ''),
    );
    this.overlay = s('g', { class: 'overlay' });
    this.markerLayer = s('g', { class: 'markers' });
    this.playerLayer = s('g', { class: 'players' });
    this.topLayer = s('g', { class: 'top' });
    this.el.append(g, this.zoneLayer, this.overlay, this.playerLayer, this.markerLayer, this.topLayer);
  }

  toCourt(cx, cy) {
    const pt = this.el.createSVGPoint(); pt.x = cx; pt.y = cy;
    const m = this.el.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  setMode(mode) { this.o.mode = mode; this.el.dataset.mode = mode; }

  /** players: [{id, x, y, number, label, role, libero, mine, error, selected, dim, setter, server, ghost}] */
  setPlayers(list, { animate = true } = {}) {
    const seen = new Set();
    this.el.classList.toggle('no-anim', !animate);
    for (const p of list) {
      seen.add(p.id);
      let n = this.nodes.get(p.id);
      if (!n) {
        n = s('g', { class: 'pl', 'data-id': p.id, tabindex: this.o.interactive ? 0 : -1, role: 'button' });
        n.append(
          s('circle', { class: 'pl-halo', r: R + 0.32 }),
          s('circle', { class: 'pl-disc', r: R }),
          s('text', { class: 'pl-num', 'text-anchor': 'middle', y: 0.22 }),
          s('text', { class: 'pl-label', 'text-anchor': 'middle', y: R + 0.5 }),
          s('g', { class: 'pl-tag' }, s('rect', { x: -0.5, y: -R - 0.62, width: 1, height: 0.46, rx: 0.12 }), s('text', { 'text-anchor': 'middle', y: -R - 0.27 }, t('you'))),
        );
        n.style.transform = `translate(${p.x}px, ${p.y}px)`;
        n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.o.onPlayerTap?.(p.id); } });
        this.playerLayer.append(n);
        this.nodes.set(p.id, n);
      }
      n.querySelector('.pl-num').textContent = p.number ?? '';
      n.querySelector('.pl-label').textContent = p.label ?? '';
      n.setAttribute('aria-label', `${p.label || ''} ${p.number ?? ''}`);
      n.setAttribute('class', ['pl', 'r-' + (p.role || 'U'), p.libero && 'lib', p.mine && 'mine', p.error && 'err', p.selected && 'sel', p.dim && 'dim', p.setter && 'setter', p.server && 'server', p.ghost && 'ghost', p.ok && 'okp'].filter(Boolean).join(' '));
      if (!this.dragging || this.dragging.id !== p.id) n.style.transform = `translate(${p.x}px, ${p.y}px)`;
      n._pos = { x: p.x, y: p.y };
    }
    for (const [id, n] of this.nodes) if (!seen.has(id)) { n.remove(); this.nodes.delete(id); }
    if (!animate) requestAnimationFrame(() => this.el.classList.remove('no-anim'));
  }

  highlightZones(zones = [], cls = 'hl') {
    this.zoneLayer.querySelectorAll('.zone-hit').forEach((r) => r.classList.toggle(cls, zones.includes(+r.dataset.zone)));
  }

  /** Antwort-Marker (Quiz/Minigame): [{id, x, y, label}] */
  setMarkers(list = [], onTap) {
    this.markerLayer.replaceChildren();
    for (const m of list) {
      const g = s('g', { class: 'marker ' + (m.cls || ''), 'data-mid': m.id, transform: `translate(${m.x} ${m.y})`, tabindex: 0, role: 'button', 'aria-label': m.label });
      g.append(s('circle', { r: 0.62 }), s('text', { 'text-anchor': 'middle', y: 0.22 }, m.label));
      const fire = (e) => { e.stopPropagation(); haptic(10); onTap?.(m.id); };
      g.addEventListener('pointerup', fire);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') fire(e); });
      this.markerLayer.append(g);
    }
  }

  setOverlay(nodes = []) { this.overlay.replaceChildren(...nodes); }
  setTop(nodes = []) { this.topLayer.replaceChildren(...nodes); }

  bind() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const g = e.target.closest('.pl');
      const p0 = this.toCourt(e.clientX, e.clientY);
      this.press = { id: g?.dataset.id || null, start: p0, cx: e.clientX, cy: e.clientY, moved: false, pid: e.pointerId };
      if (g && this.o.mode !== 'static' && this.o.draggable !== false) { try { el.setPointerCapture(e.pointerId); } catch { /* ok */ } }
    });
    el.addEventListener('pointermove', (e) => {
      const pr = this.press;
      if (!pr || !pr.id || this.o.mode === 'static' || this.o.draggable === false) return;
      if (!pr.moved && Math.hypot(e.clientX - pr.cx, e.clientY - pr.cy) < 7) return;
      pr.moved = true;
      const n = this.nodes.get(pr.id);
      const p = this.toCourt(e.clientX, e.clientY);
      if (!this.dragging) { this.dragging = { id: pr.id }; n.classList.add('dragging'); haptic(6); }
      n.style.transform = `translate(${p.x}px, ${p.y}px)`;
      if (this.o.mode === 'zones') {
        const overBench = document.elementsFromPoint(e.clientX, e.clientY).some((x) => x.dataset?.drop === 'bench');
        this.highlightZones(overBench ? [] : [nearestZone(p.x, p.y)].filter(Boolean), 'drop');
        document.querySelector('[data-drop="bench"]')?.classList.toggle('drop-over', overBench);
      } else this.o.onMove?.(pr.id, p.x, p.y, false);
    });
    const end = (e) => {
      const pr = this.press; this.press = null;
      if (!pr) return;
      const p = this.toCourt(e.clientX, e.clientY);
      if (pr.moved && pr.id) {
        const n = this.nodes.get(pr.id); n?.classList.remove('dragging');
        this.dragging = null;
        this.highlightZones([], 'drop');
        document.querySelector('[data-drop="bench"]')?.classList.remove('drop-over');
        if (this.o.mode === 'zones') {
          const overBench = document.elementsFromPoint(e.clientX, e.clientY).some((x) => x.dataset?.drop === 'bench');
          const zone = overBench ? 0 : nearestZone(p.x, p.y);
          const handled = this.o.onDrop?.(pr.id, overBench ? { bench: true } : { zone });
          if (!handled && n?._pos) n.style.transform = `translate(${n._pos.x}px, ${n._pos.y}px)`;
        } else {
          this.o.onMove?.(pr.id, Math.max(-1, Math.min(10, p.x)), Math.max(-0.2, Math.min(10.6, p.y)), true);
        }
        return;
      }
      if (e.type === 'pointercancel') return;
      if (pr.id) { haptic(8); this.o.onPlayerTap?.(pr.id); return; }
      if (e.target.closest('.marker')) return;
      const zone = nearestZone(p.x, p.y);
      this.o.onCourtTap?.(p.x, p.y, zone);
      if (zone) this.o.onZoneTap?.(zone);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /** Bank-Chip (HTML) per Drag aufs Feld ziehen. */
  attachExternalDrag(chip, id, ghostLabel) {
    chip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const st = { x: e.clientX, y: e.clientY, moved: false };
      let ghost = null;
      const move = (ev) => {
        if (!st.moved && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) < 8) return;
        if (!st.moved) { st.moved = true; ghost = h('div', { class: 'drag-ghost' }, ghostLabel); document.body.append(ghost); haptic(6); chip.classList.add('dragging'); }
        ev.preventDefault();
        ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
        const p = this.toCourt(ev.clientX, ev.clientY);
        this.highlightZones([nearestZone(p.x, p.y)].filter(Boolean), 'drop');
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        chip.classList.remove('dragging');
        this.highlightZones([], 'drop');
        if (!st.moved) return; // Tap wird vom Chip selbst behandelt
        ghost?.remove();
        chip._suppressClick = true; setTimeout(() => { chip._suppressClick = false; }, 50);
        const r = this.el.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
        const p = this.toCourt(ev.clientX, ev.clientY);
        const zone = nearestZone(p.x, p.y);
        if (zone) this.o.onDrop?.(id, { zone });
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }
}

/** Pfeil (für Lernmodus/Taktik): von a nach b */
export function arrow(a, b, cls = 'arrow') {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const tip = { x: b.x - ux * 0.7, y: b.y - uy * 0.7 };
  const base = { x: tip.x - ux * 0.45, y: tip.y - uy * 0.45 };
  const left = { x: base.x - uy * 0.28, y: base.y + ux * 0.28 }, right = { x: base.x + uy * 0.28, y: base.y - ux * 0.28 };
  return s('g', { class: cls },
    s('line', { x1: a.x + ux * 0.7, y1: a.y + uy * 0.7, x2: base.x, y2: base.y }),
    s('polygon', { points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}` }));
}
