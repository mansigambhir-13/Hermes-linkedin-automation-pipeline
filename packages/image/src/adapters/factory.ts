import type { ImageModelAdapter } from '../types.js';
import { StubImageAdapter } from './stub.js';
import { GatewayImageAdapter } from './gateway.js';
import { FalImageAdapter } from './fal.js';
import { HardenedAdapter } from './hardened.js';

type AdapterName = 'fal' | 'gateway' | 'stub';

/** Build a raw (un-hardened) adapter by name. */
function build(name: AdapterName): ImageModelAdapter {
  switch (name) {
    case 'stub':
      return new StubImageAdapter();
    case 'gateway':
      return new GatewayImageAdapter();
    default:
      return new FalImageAdapter();
  }
}

/**
 * Directive 02: default adapter is **fal**. `IMAGE_ADAPTER=stub` for dev/CI (no key); `gateway` is the
 * fallback escape hatch. The chosen adapter is wrapped in HardenedAdapter (timeout + output validation),
 * with an OPT-IN secondary via `IMAGE_FALLBACK_ADAPTER` (e.g. `gateway`) for prod resilience.
 */
export function createImageAdapter(): ImageModelAdapter {
  const primaryName = (process.env.IMAGE_ADAPTER as AdapterName) ?? 'fal';
  const primary = build(primaryName);
  const fallbackName = process.env.IMAGE_FALLBACK_ADAPTER as AdapterName | undefined;
  const fallback = fallbackName && fallbackName !== primaryName ? build(fallbackName) : undefined;
  return new HardenedAdapter(primary, fallback);
}
