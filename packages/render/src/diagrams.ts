import { BRAND } from './tokens.js';
import { esc } from './util.js';

/**
 * The 7 MBA-framework diagram renderers, ported from postizz jargons/_build.py. Each returns an HTML
 * fragment that drops into the `.diag` slot of the jargon card; the matching CSS lives in jargonCss().
 * Colors come from the brand palette (one stop per item).
 */
const PAL = BRAND.palette;

export interface LabeledItem {
  label: string;
  sub: string;
}
export interface VersusSide {
  title: string;
  line: string;
  color?: string; // defaults to a palette stop
}
export interface FocusItem {
  label: string;
  highlight?: boolean; // the one differentiated bar (the USP)
}

export type DiagramSpec =
  | { type: 'grid'; items: LabeledItem[] }
  | { type: 'steps'; items: LabeledItem[] }
  | { type: 'funnel'; items: LabeledItem[] }
  | { type: 'pyramid'; items: LabeledItem[] }
  | { type: 'curve'; phases: string[] }
  | { type: 'versus'; a: VersusSide; b: VersusSide }
  | { type: 'focus'; items: FocusItem[] };

function grid(items: LabeledItem[]): string {
  const cells = items
    .map(
      (it, i) =>
        `<div class="cell" style="--c:${PAL[i % 4]}"><div class="pi">●</div>` +
        `<div><div class="cl">${esc(it.label)}</div><div class="cs">${esc(it.sub)}</div></div></div>`,
    )
    .join('');
  return `<div class="dgrid">${cells}</div>`;
}

function steps(items: LabeledItem[]): string {
  const seg: string[] = [];
  items.forEach((it, i) => {
    seg.push(
      `<div class="step"><div class="num" style="--c:${PAL[i % 4]}">${i + 1}</div>` +
        `<div class="sl">${esc(it.label)}</div><div class="ss">${esc(it.sub)}</div></div>`,
    );
    if (i < items.length - 1) seg.push('<div class="arrow">→</div>');
  });
  return `<div class="steps">${seg.join('')}</div>`;
}

function funnel(items: LabeledItem[]): string {
  const n = items.length;
  const tiers = items
    .map((it, i) => {
      const w = 100 - i * (38 / Math.max(1, n - 1));
      return `<div class="tier" style="width:${w.toFixed(0)}%;--c:${PAL[i % 4]}">` +
        `<span class="tl">${esc(it.label)}</span><span class="ts">${esc(it.sub)}</span></div>`;
    })
    .join('');
  return `<div class="funnel">${tiers}</div>`;
}

function pyramid(items: LabeledItem[]): string {
  const n = items.length;
  // i=0 is the bottom (widest); column-reverse flips visual order.
  const tiers = items
    .map((it, i) => {
      const w = 100 - (n - 1 - i) * (52 / Math.max(1, n - 1));
      return `<div class="ptier" style="width:${w.toFixed(0)}%;--c:${PAL[(n - 1 - i) % 4]}">` +
        `<span class="tl">${esc(it.label)}</span><span class="ts">${esc(it.sub)}</span></div>`;
    })
    .join('');
  return `<div class="pyr">${tiers}</div>`;
}

function curve(phases: string[]): string {
  const labels = phases.map((p, i) => `<div class="ph" style="--c:${PAL[i % 4]}">${esc(p)}</div>`).join('');
  const svg =
    '<svg viewBox="0 0 900 200" class="csvg" preserveAspectRatio="none">' +
    '<defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#9677f8"/><stop offset="0.4" stop-color="#4e44fd"/>' +
    '<stop offset="0.72" stop-color="#ff4859"/><stop offset="1" stop-color="#00c483"/></linearGradient></defs>' +
    '<path d="M10,180 C220,180 250,40 470,35 C600,32 640,40 700,70 C780,110 840,150 890,178" ' +
    'fill="none" stroke="url(#cg)" stroke-width="6" stroke-linecap="round"/></svg>';
  return `<div class="curve">${svg}<div class="phases">${labels}</div></div>`;
}

function versus(a: VersusSide, b: VersusSide): string {
  const col = (d: VersusSide, i: number): string =>
    `<div class="vcol" style="--c:${d.color ?? PAL[i === 0 ? 3 : 2]}"><div class="vt">${esc(d.title)}</div>` +
    `<div class="vl">${esc(d.line)}</div></div>`;
  return `<div class="versus">${col(a, 0)}<div class="vx">vs</div>${col(b, 1)}</div>`;
}

function focus(items: FocusItem[]): string {
  const bars = items
    .map((it) => `<div class="${it.highlight ? 'fbar you' : 'fbar'}"><span>${esc(it.label)}</span></div>`)
    .join('');
  return `<div class="focus">${bars}</div>`;
}

/** Dispatch a diagram spec to its renderer. */
export function renderDiagram(spec: DiagramSpec): string {
  switch (spec.type) {
    case 'grid':
      return grid(spec.items);
    case 'steps':
      return steps(spec.items);
    case 'funnel':
      return funnel(spec.items);
    case 'pyramid':
      return pyramid(spec.items);
    case 'curve':
      return curve(spec.phases);
    case 'versus':
      return versus(spec.a, spec.b);
    case 'focus':
      return focus(spec.items);
  }
}

/** The CSS for all diagram variants — injected into the jargon card's <style>. */
export function diagramCss(): string {
  return `
.dgrid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,0.08)}
.cell{display:flex;align-items:center;gap:16px;padding:24px 8px}
.cell:nth-child(odd){border-right:1px solid rgba(255,255,255,0.08);padding-right:26px}
.cell:nth-child(even){padding-left:30px}
.cell:nth-child(1),.cell:nth-child(2){border-bottom:1px solid rgba(255,255,255,0.08)}
.cell .pi{font-size:34px;line-height:0.8;color:var(--c)}
.cell .cl{font-weight:700;font-size:27px;color:#f4f5f7;letter-spacing:-0.3px}.cell .cs{font-weight:300;font-size:18px;color:#8b909b;margin-top:2px}
.steps{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}
.step{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center}
.step .num{width:64px;height:64px;border-radius:50%;border:2px solid var(--c);color:var(--c);font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center}
.step .sl{margin-top:14px;font-weight:700;font-size:25px;color:#f4f5f7}.step .ss{font-weight:300;font-size:18px;color:#8b909b;margin-top:3px}
.arrow{align-self:center;margin-top:18px;color:#5a5f6a;font-size:34px}
.funnel{display:flex;flex-direction:column;align-items:center;gap:9px}
.tier{height:64px;border-radius:12px;background:#15151c;border-left:5px solid var(--c);display:flex;align-items:center;justify-content:space-between;padding:0 26px}
.tier .tl{font-weight:700;font-size:25px;color:#f4f5f7}.tier .ts{font-weight:300;font-size:18px;color:#8b909b}
.pyr{display:flex;flex-direction:column-reverse;align-items:center;gap:9px}
.ptier{height:62px;border-radius:12px;background:#15151c;border-left:5px solid var(--c);display:flex;align-items:center;justify-content:space-between;padding:0 26px}
.ptier .tl{font-weight:700;font-size:24px;color:#f4f5f7}.ptier .ts{font-weight:300;font-size:17px;color:#8b909b}
.curve{margin-top:6px}.csvg{width:100%;height:190px;display:block}
.phases{display:flex;justify-content:space-between;margin-top:8px}
.ph{font-weight:700;font-size:22px;color:#f4f5f7;border-top:3px solid var(--c);padding-top:8px}
.versus{display:flex;align-items:stretch;gap:18px}
.vcol{flex:1;border-radius:18px;background:#15151c;border-top:4px solid var(--c);padding:24px 26px}
.vcol .vt{font-weight:800;font-size:30px;color:var(--c)}.vcol .vl{margin-top:10px;font-weight:300;font-size:23px;line-height:1.35;color:#d4d7dd}
.vx{align-self:center;font-weight:800;font-size:26px;color:#5a5f6a}
.focus{display:flex;flex-direction:column;gap:12px}
.fbar{height:60px;border-radius:12px;background:#15151c;display:flex;align-items:center;padding:0 26px;font-weight:600;font-size:24px;color:#7b808b;width:70%}
.fbar.you{background:rgba(255,72,89,0.14);color:#fff;font-weight:800;width:100%;border-left:5px solid ${BRAND.coral}}`.trim();
}
