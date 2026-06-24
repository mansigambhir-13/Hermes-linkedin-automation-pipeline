/**
 * Phase 2 stub-mode smoke — proves the full image pipeline (route → brand-aware prompt → adapter →
 * object store → refs) runs WITHOUT the AI Gateway key, using the StubImageAdapter.
 * Run from repo root: pnpm exec tsx packages/image/scripts/smoke.ts
 * (cwd=root so config/image_routing.json + .artifacts resolve.)
 */
import { ImageEngine, StubImageAdapter } from '../src/index.js';

const engine = new ImageEngine(new StubImageAdapter());

const refs = await engine.assembleCarousel({
  postId: 'smoke-test',
  aspectRatio: '1:1',
  seed: 42,
  styleSpec: {
    palette: ['#0a0a0a', '#ffffff', '#9677f8', '#00c483'],
    type_treatment: 'Raleway; gradient-filled key word',
    layout_grammar: 'dark field; headline upper-third; generous negative space',
    illustration_style: 'conceptual, metaphorical, cinematic',
  },
  slides: [
    { concept: 'a lone figure on a circuit-tree' },
    { concept: 'a cracking pillar of money' },
    { concept: 'a key turning in a lock' },
  ],
});

console.log('carousel refs:', refs.map((r) => `${r.slideIndex}:${r.storageKey} (${r.modelUsed})`));
const ok = refs.length === 3 && refs.every((r) => r.storageKey.startsWith('posts/smoke-test/'));
console.log(ok ? 'PASS — stub image pipeline produced a 3-slide carousel (one seed, uniform 1:1).' : 'FAIL');
process.exit(ok ? 0 : 1);
