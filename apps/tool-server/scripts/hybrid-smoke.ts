/**
 * Phase 3 hybrid smoke — two proofs, no fal key required:
 *  1. RENDER PROOF: composite the brand frame + typeset headline over a REAL local image (file://) so you
 *     can eyeball legibility/scrim. (Independent of any AI.)
 *  2. WIRING PROOF: run the full orchestrator (AI background → overlay) with IMAGE_ADAPTER=stub.
 *
 *   IMAGE_ADAPTER=stub node --import tsx apps/tool-server/scripts/hybrid-smoke.ts
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RenderEngine } from '@rss/render';
import { makeHybridDeps, renderHybridCarousel } from '@rss/agent';

async function main(): Promise<void> {
  // 1. Render proof — real background image, no AI.
  const bg = pathToFileURL(resolve('brand-assets/landing-screenshots/01-hero-think-like-an-mba.png')).href;
  const render = new RenderEngine();
  try {
    const a = await render.renderCard({
      postId: 'hybrid-render-proof',
      template: 'hybrid',
      aspectRatio: '4:5',
      data: {
        backgroundUrl: bg,
        eyebrow: 'The Pattern',
        headline: 'You rehearsed the answer. Not the follow-up.',
        sub: 'The panel lives in the second question.',
      },
    });
    console.log('render proof  →', a.storageKey, `(${a.modelUsed})`);
  } finally {
    await render.close();
  }

  // 2. Wiring proof — full orchestrator with the stub image adapter (set IMAGE_ADAPTER=stub).
  const deps = makeHybridDeps();
  try {
    const refs = await renderHybridCarousel(deps, {
      postId: 'hybrid-wiring-proof',
      aspectRatio: '4:5',
      seed: 42,
      slides: [
        { concept: 'A lone figure on a circuit-tree at dusk', headline: 'The CV got you the call.', footer: false },
        { concept: 'A cracking marble pillar of money', headline: 'The follow-up loses the room.' },
      ],
    });
    console.log('wiring proof  →', refs.map((r) => r.storageKey).join(', '), `(${refs[0]?.modelUsed})`);
    console.log('OK — check .artifacts/posts/hybrid-* (render proof shows the real composite).');
  } finally {
    await deps.render.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
