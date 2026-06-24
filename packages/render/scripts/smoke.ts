/**
 * Phase 1 smoke test: render one statement card + one glossary card to the local artifacts dir,
 * with no AI and no network beyond the webfont. Proves the deterministic pipeline end-to-end.
 *
 *   pnpm --filter @rss/render smoke
 *   # outputs land under .artifacts/posts/smoke-... /0.png
 */
import { RenderEngine } from '../src/engine.js';

async function main(): Promise<void> {
  const engine = new RenderEngine();
  try {
    const a = await engine.renderCard({
      postId: 'smoke-statement',
      template: 'statement',
      aspectRatio: '4:5',
      data: {
        eyebrow: 'The Pattern',
        headline: 'You rehearsed the answer. Not the follow-up.',
        sub: 'The panel lives in the second question.',
      },
    });
    console.log('statement →', a.storageKey, `(${a.modelUsed})`);

    const b = await engine.renderCard({
      postId: 'smoke-glossary',
      template: 'glossary',
      aspectRatio: '4:5',
      data: {
        headline: "Goodhart's Law",
        paragraphs: [
          'When a measure becomes a target, it stops being a good measure.',
          'A team optimizes the metric, then the metric quietly stops describing the thing it was meant to track.',
          'Every number you incentivise is a number you can no longer fully trust.',
        ],
      },
    });
    console.log('glossary  →', b.storageKey, `(${b.modelUsed})`);

    const c = await engine.renderCarousel({
      postId: 'smoke-carousel',
      template: 'statement',
      aspectRatio: '4:5',
      slides: [
        { eyebrow: 'Slide 1', headline: 'The CV got you the call.', footer: false },
        { eyebrow: 'Slide 2', headline: 'The follow-up loses the room.', footer: false },
        { headline: 'Practice the second question.' },
      ],
    });
    console.log('carousel  →', c.map((r) => r.storageKey).join(', '));
    console.log('OK — check the .artifacts/ folder for the PNGs.');
  } finally {
    await engine.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
