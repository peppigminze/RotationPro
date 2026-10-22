// Export: SVG-Feld → PNG, teilen über Web Share API (Fallback: Download)
import { toast } from './dom.js';
import { t, addStrings } from '../i18n.js';

addStrings({
  de: { shareDone: 'Bild gespeichert', shareFail: 'Export nicht möglich' },
  en: { shareDone: 'Image saved', shareFail: 'Export failed' },
});

const PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'display', 'paint-order', 'visibility', 'text-anchor'];

function inlineStyles(src, dst) {
  const cs = getComputedStyle(src);
  let style = '';
  for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v) style += `${p}:${v};`; }
  const tr = src.style?.transform;
  if (tr && tr.startsWith('translate')) {
    const m = tr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (m) dst.setAttribute('transform', `translate(${m[1]} ${m[2]})`);
  }
  dst.setAttribute('style', style);
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
}

export async function svgToPng(svg, title = '', scale = 2) {
  const clone = svg.cloneNode(true);
  inlineStyles(svg, clone);
  clone.querySelectorAll('.pl').forEach((g) => { g.style.animation = 'none'; });
  const rect = svg.getBoundingClientRect();
  const w = Math.max(600, Math.round(rect.width)) * scale;
  const vb = svg.viewBox.baseVal;
  const hgt = Math.round((w * vb.height) / vb.width);
  clone.setAttribute('width', w); clone.setAttribute('height', hgt);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  await img.decode();
  const head = title ? 70 * scale / 2 : 0;
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt + head;
  const ctx = c.getContext('2d');
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#0F1B2E';
  ctx.fillRect(0, 0, c.width, c.height);
  if (title) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#fff';
    ctx.font = `700 ${22 * scale}px "Barlow Condensed", Arial Narrow, sans-serif`;
    ctx.fillText(title, 16 * scale, 44 * scale / 2 + 10 * scale);
    ctx.fillStyle = '#F5C518';
    ctx.font = `800 ${14 * scale}px "Barlow Condensed", sans-serif`;
    ctx.fillText('RotationPro', c.width - 100 * scale, 44 * scale / 2 + 10 * scale);
  }
  ctx.drawImage(img, 0, head, w, hgt);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(t('shareDone'), 'ok');
}

export async function shareCourt(svg, title) {
  try {
    const blob = await svgToPng(svg, title);
    await shareBlob(blob, 'rotationpro-' + title.replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 40) + '.png', title);
  } catch (e) { console.error(e); toast(t('shareFail'), 'err'); }
}
