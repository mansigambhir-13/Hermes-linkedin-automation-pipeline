import type { AspectRatio } from '@rss/core';

/**
 * Brand tokens — the CSS-side source of truth for the deterministic renderer.
 *
 * This is the hex/typography counterpart to the PROSE brand block in `@rss/image` brand.ts
 * (BRAND_VISUAL_BLOCK). Rule of thumb (mirrors brand.ts): the AI image prompts only ever see the
 * PROSE description; the deterministic HTML renderer only ever sees these exact hex/font tokens.
 * Keep the two in sync when the brand changes. Source: brand/brief.md §10-11 + postizz README §1.
 */
export const BRAND = {
  // Color tokens (exact hex — never approximate; postizz README §1.1)
  ink: '#0a0a0c', // near-black canvas
  cardSurface: '#141418',
  bodyText: '#d6dae1',
  mutedText: '#8b909b',
  white: '#ffffff',
  // The signature rainbow gradient — used as text fill, rules, underlines, the bottom stripe.
  gradient: 'linear-gradient(90deg,#9677f8 0%,#4e44fd 33%,#ff4859 66%,#00c483 100%)',
  green: '#00c483', // solid CTA button color
  greenInk: '#06231a', // text on the green pill
  coral: '#ff4859',
  // The four gradient stops as discrete swatches — used to color diagram elements (one per item).
  palette: ['#9677f8', '#4e44fd', '#ff4859', '#00c483'] as const,
  // Typography. Raleway is bundled locally and inlined as base64 @font-face (see fonts.ts) — renders need
  // NO network, fixing postizz's webfont-over-the-wire weakness. Docker/worker-safe.
  fontFamily: "'Raleway', sans-serif",
} as const;

/** Canvas pixel size per platform aspect ratio. The viewport MUST equal these or the screenshot crops. */
export const CANVAS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 }, // Instagram square
  '4:5': { width: 1080, height: 1350 }, // LinkedIn / Instagram portrait
  '9:16': { width: 1080, height: 1920 }, // poster / story
  '1.91:1': { width: 1200, height: 628 }, // link card
};

/** Shared brand furniture as a CSS string, parameterized by canvas size. Injected into every template. */
export function brandCss(width: number, height: number): string {
  return `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px;background:${BRAND.ink};overflow:hidden;font-family:${BRAND.fontFamily};color:${BRAND.white}}
.canvas{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:${BRAND.ink};display:flex;flex-direction:column;align-items:center}
.glow{position:absolute;top:-150px;left:50%;transform:translateX(-50%);width:1240px;height:720px;z-index:0;background:radial-gradient(ellipse at center,rgba(0,196,131,0.18) 0%,rgba(0,196,131,0.05) 45%,transparent 72%)}
.grad-text{background:${BRAND.gradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent}
.wm{font-weight:400;font-size:48px;letter-spacing:-1.1px;line-height:0.9;color:${BRAND.white}}
.wm span{font-weight:200}
.wmline{width:158px;height:5px;border-radius:3px;background:${BRAND.gradient}}
.cta{display:inline-flex;align-items:center;gap:12px;background:${BRAND.green};color:${BRAND.greenInk};font-weight:800;font-size:25px;letter-spacing:0.3px;padding:17px 40px;border-radius:100px}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.022) 1px,transparent 1px);background-size:3px 3px;opacity:0.4;pointer-events:none;z-index:5}
.stripe{position:absolute;left:0;bottom:0;width:100%;height:8px;background:${BRAND.gradient};z-index:6}
`.trim();
}
