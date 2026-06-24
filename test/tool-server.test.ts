/**
 * The tool-server registers the expected toolset (regression guard for the render/hybrid/jargon tools).
 * buildServer constructs engines lazily (no Chromium / no network), so this is safe with no env. Run: pnpm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../apps/tool-server/src/server.js';

function toolNames(): string[] {
  const server = buildServer() as unknown as { _registeredTools?: Record<string, unknown> };
  return Object.keys(server._registeredTools ?? {});
}

test('tool-server exposes the deterministic render + hybrid + jargon tools', () => {
  const names = toolNames();
  for (const expected of [
    'compose_caption',
    'save_draft',
    'generate_image',
    'assemble_carousel',
    'render_card',
    'render_carousel',
    'render_jargon_card',
    'render_hybrid_card',
    'render_hybrid_carousel',
    'publish_linkedin_single',
    'publish_instagram',
  ]) {
    assert.ok(names.includes(expected), `missing tool: ${expected}`);
  }
});

test('all five visual tools are present (the four-way capability + carousels)', () => {
  const visual = toolNames().filter((n) => n.startsWith('render') || n === 'generate_image' || n === 'assemble_carousel');
  assert.equal(visual.length, 7, `unexpected visual tool set: ${visual.join(', ')}`);
});
