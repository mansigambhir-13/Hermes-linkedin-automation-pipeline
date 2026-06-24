import type { AspectRatio } from '@rss/core';
import { BRAND, CANVAS, brandCss } from './tokens.js';
import { fontFaceCss } from './fonts.js';
import { esc, escWithBold } from './util.js';
import { renderDiagram, diagramCss, type DiagramSpec } from './diagrams.js';

/** Auto-scale the headline by length (ported from postizz hsize()). */
function hsize(headline: string): number {
  const n = headline.length;
  if (n <= 10) return 70;
  if (n <= 13) return 62;
  if (n <= 20) return 54;
  if (n <= 26) return 46;
  return 40;
}

function doc(width: number, height: number, css: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>${fontFaceCss()}
${brandCss(width, height)}
${css}</style></head><body><div class="canvas">${body}
<div class="grain"></div><div class="stripe"></div></div></body></html>`;
}

export interface StatementData {
  /** The on-card line(s) — the hook / data point / quote. Rendered in exact rainbow-gradient Raleway. */
  headline: string;
  /** Optional sub-line under the headline. */
  sub?: string;
  /** Optional small eyebrow/masthead above (e.g. "THE BUSINESS GLOSSARY"). */
  eyebrow?: string;
  /** Show the wordmark + CTA footer (default true). */
  footer?: boolean;
}

/**
 * The statement / quote / data card — a pure-typeset brand slide. This is the deterministic answer to
 * promptAssembly.ts "poster" mode: the headline is rendered by a real font engine (never hallucinated),
 * on the exact brand frame. Good for carousel covers, data points, and quotes.
 */
export function statementCard(data: StatementData, aspectRatio: AspectRatio): string {
  const { width, height } = CANVAS[aspectRatio];
  const showFooter = data.footer ?? true;
  const css = `
.wrap{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:96px 90px}
.eyebrow{display:flex;align-items:center;gap:16px;margin-bottom:6px}
.eyebrow .er{width:42px;height:4px;border-radius:2px;background:${BRAND.gradient}}
.eyebrow .et{font-weight:800;font-size:27px;letter-spacing:6px;text-transform:uppercase;color:${BRAND.white}}
.statement{font-weight:900;font-size:${hsize(data.headline)}px;line-height:1.02;letter-spacing:-2px;text-align:center}
.sub{font-weight:300;font-size:30px;line-height:1.4;color:${BRAND.bodyText};text-align:center;max-width:840px}
.foot{position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;gap:11px;padding-bottom:40px}`;
  const eyebrow = data.eyebrow
    ? `<div class="eyebrow"><div class="er"></div><div class="et">${esc(data.eyebrow)}</div><div class="er"></div></div>`
    : '';
  const sub = data.sub ? `<div class="sub">${esc(data.sub)}</div>` : '';
  const foot = showFooter
    ? `<div class="foot"><div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>`
    : '';
  const body = `<div class="glow"></div>
<div class="wrap">${eyebrow}<div class="statement grad-text">${esc(data.headline)}</div>${sub}</div>
${foot}`;
  return doc(width, height, css, body);
}

export interface GlossaryData {
  eyebrow?: string; // default "THE BUSINESS GLOSSARY"
  headline: string;
  /** Body paragraphs (already brand-voice). Names can be pre-bolded with <b>…</b> by the caller. */
  paragraphs: string[];
  /** Optional banner image URL (file:// or https) shown at the top of the card. */
  bannerUrl?: string;
  ctaLabel?: string; // default "Download the Rehearsal app"
}

/**
 * The "green knowledge card" — ported faithfully from postizz glossary/linkdn/_build.py.
 * One business concept per card: masthead → course image banner → rainbow headline → brand-voice body.
 */
export function glossaryCard(data: GlossaryData, aspectRatio: AspectRatio = '4:5'): string {
  const { width, height } = CANVAS[aspectRatio];
  const css = `
.canvas{justify-content:flex-start;padding:40px 0 32px}
.mast{position:relative;z-index:3;display:flex;align-items:center;gap:16px;margin-bottom:18px}
.mast .mrule{width:42px;height:4px;border-radius:2px;background:${BRAND.gradient}}
.mast .mtitle{font-weight:800;font-size:27px;letter-spacing:6px;text-transform:uppercase;color:${BRAND.white}}
.card{position:relative;z-index:3;width:1004px;border-radius:40px;background:${BRAND.cardSurface};border:1px solid rgba(0,196,131,0.28);overflow:hidden;box-shadow:0 40px 110px rgba(0,0,0,0.6)}
.banner{display:block;width:100%;height:620px;object-fit:cover;background:#0f0f12}
.body{padding:28px 46px 30px}
.headline{font-weight:900;font-size:${hsize(data.headline)}px;line-height:0.98;letter-spacing:-2px}
.def{margin-top:15px;font-weight:300;font-size:26px;line-height:1.4;color:${BRAND.bodyText}}
.def b{font-weight:800;color:${BRAND.white}}
.footzone{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:17px}
.foot{display:flex;flex-direction:column;align-items:center;gap:11px}`;
  const eyebrow = esc(data.eyebrow ?? 'The Business Glossary');
  const banner = data.bannerUrl ? `<img class="banner" src="${esc(data.bannerUrl)}">` : '';
  // paragraphs may contain caller-inserted <b>…</b> for bolded names — escape text but preserve <b>/</b>.
  const paras = data.paragraphs
    .slice(0, 3)
    .map((p) => `<div class="def">${escWithBold(p)}</div>`)
    .join('\n      ');
  const cta = esc(data.ctaLabel ?? 'Download the Rehearsal app');
  const body = `<div class="glow"></div>
  <div class="mast"><div class="mrule"></div><div class="mtitle">${eyebrow}</div><div class="mrule"></div></div>
  <div class="card">${banner}<div class="body"><div class="headline grad-text">${esc(data.headline)}</div>
      ${paras}</div></div>
  <div class="footzone"><div class="foot"><div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>
    <div class="cta">${cta}</div></div>`;
  return doc(width, height, css, body);
}

export interface HybridData {
  /** URL of the AI-generated EDITORIAL background (no text in it). file:// in dev, https in prod. */
  backgroundUrl: string;
  headline: string;
  sub?: string;
  eyebrow?: string;
  footer?: boolean;
  /** Dark scrim opacity over the background, 0–1 (default 0.62). Higher = more legible text, less image. */
  scrim?: number;
}

/**
 * Phase 3 — the hybrid composite. The AI provides a wordless editorial BACKGROUND (the thing it is good at);
 * this template lays it full-bleed, drops a dark brand scrim over it for legibility, then typesets the
 * EXACT brand frame on top (rainbow-gradient headline in real Raleway, wordmark, stripe). The AI never
 * renders text; the brand furniture is always pixel-exact. This is the answer to "conceptual imagery OR
 * perfect text" — now it's both.
 */
export function hybridCard(data: HybridData, aspectRatio: AspectRatio): string {
  const { width, height } = CANVAS[aspectRatio];
  const showFooter = data.footer ?? true;
  const scrim = Math.min(1, Math.max(0, data.scrim ?? 0.62));
  // Slightly stronger at top + bottom (where eyebrow and wordmark sit) so copy never fights the image.
  const css = `
.bg{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover}
.scrim{position:absolute;inset:0;z-index:1;background:
  linear-gradient(180deg, rgba(10,10,12,${(scrim + 0.12).toFixed(3)}) 0%, rgba(10,10,12,${scrim.toFixed(3)}) 38%, rgba(10,10,12,${scrim.toFixed(3)}) 62%, rgba(10,10,12,${(scrim + 0.18).toFixed(3)}) 100%)}
.wrap{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:96px 90px}
.eyebrow{display:flex;align-items:center;gap:16px;margin-bottom:6px}
.eyebrow .er{width:42px;height:4px;border-radius:2px;background:${BRAND.gradient}}
.eyebrow .et{font-weight:800;font-size:27px;letter-spacing:6px;text-transform:uppercase;color:${BRAND.white};text-shadow:0 2px 18px rgba(0,0,0,0.6)}
.statement{font-weight:900;font-size:${hsize(data.headline)}px;line-height:1.02;letter-spacing:-2px;text-align:center;filter:drop-shadow(0 3px 22px rgba(0,0,0,0.55))}
.sub{font-weight:300;font-size:30px;line-height:1.4;color:${BRAND.bodyText};text-align:center;max-width:840px;text-shadow:0 2px 16px rgba(0,0,0,0.7)}
.foot{position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;gap:11px;padding-bottom:40px}
.foot .wm{text-shadow:0 2px 18px rgba(0,0,0,0.6)}`;
  const eyebrow = data.eyebrow
    ? `<div class="eyebrow"><div class="er"></div><div class="et">${esc(data.eyebrow)}</div><div class="er"></div></div>`
    : '';
  const sub = data.sub ? `<div class="sub">${esc(data.sub)}</div>` : '';
  const foot = showFooter
    ? `<div class="foot"><div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>`
    : '';
  const body = `<img class="bg" src="${esc(data.backgroundUrl)}">
<div class="scrim"></div>
<div class="wrap">${eyebrow}<div class="statement grad-text">${esc(data.headline)}</div>${sub}</div>
${foot}`;
  return doc(width, height, css, body);
}

function jhsize(headline: string): number {
  const n = headline.length;
  return n <= 12 ? 78 : n <= 20 ? 64 : 52;
}

export interface JargonData {
  headline: string; // the framework name, e.g. "The 4 Ps"
  definition: string; // one plain-English sentence
  diagram: DiagramSpec; // one of the 7 framework diagrams
  /** Origin/insight note; names can be pre-bolded with <b>…</b> (rendered white). */
  note: string;
  subject?: string; // chip label, default "Marketing"
  accent?: string; // chip + headline accent hex, default coral
  bannerUrl?: string; // optional course image banner
}

/**
 * The "MBA Jargon" framework card — ported from postizz jargons/_build.py. Masthead → subject chip →
 * optional course banner → accent headline → one-line definition → a framework DIAGRAM → origin note.
 * This is the distinctive content type: a named framework taught as a clean diagrammatic card.
 */
export function jargonCard(data: JargonData, aspectRatio: AspectRatio = '4:5'): string {
  const { width, height } = CANVAS[aspectRatio];
  const accent = data.accent ?? BRAND.coral;
  const css = `
.canvas{justify-content:flex-start;padding:46px 0 34px}
.mast{position:relative;z-index:3;font-weight:800;font-size:24px;letter-spacing:7px;text-transform:uppercase;color:${BRAND.white};margin-bottom:20px}
.chip{position:relative;z-index:3;margin-bottom:24px;display:inline-flex;align-items:center;gap:11px;font-weight:700;font-size:20px;letter-spacing:2.5px;text-transform:uppercase;color:${accent};background:rgba(255,72,89,0.12);border-radius:100px;padding:9px 22px}
.chip .dot{width:9px;height:9px;border-radius:50%;background:${accent}}
.card{position:relative;z-index:3;width:1004px;border-radius:44px;background:#131318;border:1px solid rgba(255,255,255,0.06);overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,0.55)}
.banner{display:block;width:100%;height:392px;object-fit:cover;background:#0f0f12}
.body{padding:36px 50px 42px}
.jhead{font-weight:900;font-size:${jhsize(data.headline)}px;line-height:0.96;letter-spacing:-2.5px;color:${accent}}
.def{margin-top:16px;font-weight:600;font-size:29px;line-height:1.34;color:#f4f5f7;max-width:880px}
.diag{margin-top:30px}
.note{margin-top:30px;font-weight:300;font-size:23px;line-height:1.46;color:#b9bdc6}.note b{font-weight:700;color:#f4f5f7}
.footzone{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.foot{display:flex;flex-direction:column;align-items:center;gap:11px}
.glow{background:radial-gradient(ellipse at center,rgba(255,72,89,0.12) 0%,transparent 72%);top:-160px;width:1200px;height:660px}
${diagramCss()}`;
  const banner = data.bannerUrl ? `<img class="banner" src="${esc(data.bannerUrl)}">` : '';
  const body = `<div class="glow"></div>
  <div class="mast">MBA Jargon</div>
  <div class="chip"><span class="dot"></span>${esc(data.subject ?? 'Marketing')}</div>
  <div class="card">${banner}<div class="body">
      <div class="jhead">${esc(data.headline)}</div>
      <div class="def">${esc(data.definition)}</div>
      <div class="diag">${renderDiagram(data.diagram)}</div>
      <div class="note">${escWithBold(data.note)}</div>
    </div></div>
  <div class="footzone"><div class="foot"><div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>
    <div class="cta">Download the Rehearsal app</div></div>`;
  return doc(width, height, css, body);
}
