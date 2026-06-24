/**
 * Unit tests for @rss/render — pure functions only, NO Chromium (CI-safe). The full pixel render is
 * covered by the package smokes (packages/render/scripts/*). Run: pnpm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  esc,
  escWithBold,
  renderDiagram,
  diagramCss,
  fontFaceCss,
  statementCard,
  glossaryCard,
  jargonCard,
  hybridCard,
  toEmbeddable,
  CANVAS,
  type DiagramSpec,
} from '@rss/render';

// ── escaping ──
test('esc neutralizes HTML-significant characters', () => {
  assert.equal(esc('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;');
});

test('escWithBold escapes text but preserves intentional <b> tags', () => {
  assert.equal(escWithBold('by <b>Kotler</b> & co'), 'by <b>Kotler</b> &amp; co');
});

// ── fonts are embedded, not fetched ──
test('fontFaceCss embeds Raleway as base64 and references no network', () => {
  const css = fontFaceCss();
  assert.match(css, /data:font\/woff2;base64,/);
  assert.doesNotMatch(css, /googleapis|gstatic/);
});

// ── every diagram type dispatches and emits its wrapper ──
const DIAGRAMS: [DiagramSpec, RegExp][] = [
  [{ type: 'grid', items: [{ label: 'A', sub: 'a' }, { label: 'B', sub: 'b' }] }, /class="dgrid"/],
  [{ type: 'steps', items: [{ label: 'A', sub: 'a' }, { label: 'B', sub: 'b' }] }, /class="steps"/],
  [{ type: 'funnel', items: [{ label: 'A', sub: 'a' }, { label: 'B', sub: 'b' }] }, /class="funnel"/],
  [{ type: 'pyramid', items: [{ label: 'A', sub: 'a' }, { label: 'B', sub: 'b' }] }, /class="pyr"/],
  [{ type: 'curve', phases: ['One', 'Two'] }, /class="curve"/],
  [{ type: 'versus', a: { title: 'X', line: 'x' }, b: { title: 'Y', line: 'y' } }, /class="versus"/],
  [{ type: 'focus', items: [{ label: 'a' }, { label: 'b', highlight: true }] }, /class="focus"/],
];
test('renderDiagram handles all 7 framework types', () => {
  for (const [spec, re] of DIAGRAMS) assert.match(renderDiagram(spec), re, `${spec.type} missing wrapper`);
  // the highlighted focus bar gets the 'you' class
  assert.match(renderDiagram({ type: 'focus', items: [{ label: 'x', highlight: true }] }), /class="fbar you"/);
  // diagram CSS includes the classes the renderers emit
  assert.match(diagramCss(), /\.dgrid|\.funnel|\.pyr/);
});

test('diagram renderers escape user content', () => {
  const html = renderDiagram({ type: 'grid', items: [{ label: '<script>', sub: 'x' }] });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

// ── template HTML invariants (brand frame present, fonts embedded, no network font) ──
test('statementCard carries the brand frame, the gradient headline, and embedded fonts', () => {
  const html = statementCard({ headline: 'Hello', sub: 'world', eyebrow: 'Eyebrow' }, '4:5');
  assert.match(html, /class="stripe"/); // bottom rainbow stripe
  assert.match(html, /grad-text/); // gradient-filled headline
  assert.match(html, /data:font\/woff2;base64,/); // embedded font
  assert.doesNotMatch(html, /googleapis/); // never the network font
  assert.match(html, /width:1080px;height:1350px/); // 4:5 canvas
});

test('glossaryCard renders its paragraphs (regression: body must not be dropped)', () => {
  const html = glossaryCard({ headline: 'Goodhart', paragraphs: ['first para', 'second para'] }, '4:5');
  assert.match(html, /first para/);
  assert.match(html, /second para/);
});

test('jargonCard renders headline, definition, the diagram, and bolded note names', () => {
  const html = jargonCard(
    { headline: 'The 4 Ps', definition: 'Four levers.', note: 'by <b>McCarthy</b>', diagram: { type: 'curve', phases: ['A', 'B'] } },
    '4:5',
  );
  assert.match(html, /The 4 Ps/);
  assert.match(html, /Four levers\./);
  assert.match(html, /class="csvg"/); // the curve SVG
  assert.match(html, /<b>McCarthy<\/b>/);
});

test('hybridCard lays the background image and a legibility scrim under the typeset frame', () => {
  const html = hybridCard({ backgroundUrl: 'https://example.com/bg.png', headline: 'H' }, '1:1');
  assert.match(html, /class="bg" src="https:\/\/example.com\/bg.png"/);
  assert.match(html, /class="scrim"/);
  assert.match(html, /grad-text/);
});

// ── toEmbeddable: file → data URI; remote/data pass through ──
test('toEmbeddable inlines a local file:// image as a data URI', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'render-test-'));
  const png = join(dir, 'x.png');
  // a 1x1 PNG
  writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  const out = await toEmbeddable(pathToFileURL(png).href);
  assert.match(out, /^data:image\/png;base64,/);
});

test('toEmbeddable passes through http(s) and data URLs untouched', async () => {
  assert.equal(await toEmbeddable('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  assert.equal(await toEmbeddable('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});

// ── canvas table is exhaustive over the supported aspect ratios ──
test('CANVAS defines exact pixel sizes for every aspect ratio', () => {
  assert.deepEqual(CANVAS['4:5'], { width: 1080, height: 1350 });
  assert.deepEqual(CANVAS['1:1'], { width: 1080, height: 1080 });
  assert.deepEqual(CANVAS['9:16'], { width: 1080, height: 1920 });
});
