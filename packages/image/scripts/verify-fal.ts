/**
 * Single real fal render — validates the adapter end-to-end (key, model id, queue poll, download)
 * before spending on the full carousel set. Run from repo root:
 *   node --env-file=.env --import tsx packages/image/scripts/verify-fal.ts
 */
import { ImageEngine } from '../src/index.js';

const engine = new ImageEngine(); // fal adapter (IMAGE_ADAPTER=fal)
try {
  const ref = await engine.generateSingle({
    postId: 'fal-verify',
    jobType: 'hero',
    concept: 'a lone figure on a glowing circuit-tree, dark editorial canvas, one bright gradient accent',
    aspectRatio: '1:1',
  });
  console.log(`PASS — fal rendered ${ref.storageKey} via ${ref.modelUsed}`);
  process.exit(0);
} catch (e) {
  console.error('fal render FAILED:', e instanceof Error ? e.message : String(e));
  process.exit(1);
}
