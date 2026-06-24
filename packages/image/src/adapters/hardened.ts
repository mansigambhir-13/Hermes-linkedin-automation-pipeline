import type { GenerateRequest, GenerateResult, ImageModelAdapter } from '../types.js';

/** Reject if `p` does not settle within `ms`. Used to bound a hung image-gen call (no infinite stalls). */
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** A result is usable only if it carries real image bytes. Guards against an adapter returning an empty/garbage payload. */
export function validateResult(result: GenerateResult, who: string): GenerateResult {
  if (!result.bytes || result.bytes.length === 0) throw new Error(`${who}: empty image bytes`);
  if (!result.mediaType?.startsWith('image/')) throw new Error(`${who}: non-image media type "${result.mediaType}"`);
  return result;
}

/**
 * Production wrapper around any image adapter: bounds each generate() with a hard timeout, validates the
 * output is a real image, and (optionally) falls back to a secondary adapter if the primary throws.
 * The fallback is OPT-IN (factory wires it only when IMAGE_FALLBACK_ADAPTER is set) so default behavior
 * is unchanged — a misconfigured prod never silently ships a placeholder.
 */
export class HardenedAdapter implements ImageModelAdapter {
  private readonly timeoutMs: number;

  constructor(
    private readonly primary: ImageModelAdapter,
    private readonly fallback?: ImageModelAdapter,
    timeoutMs = Number(process.env.IMAGE_TIMEOUT_MS ?? 90_000),
  ) {
    this.timeoutMs = timeoutMs;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    try {
      return validateResult(await withTimeout(this.primary.generate(req), this.timeoutMs, 'image generate'), 'primary');
    } catch (e) {
      if (!this.fallback) throw e;
      console.error(`[image] primary adapter failed (${e instanceof Error ? e.message : String(e)}); trying fallback`);
      return validateResult(
        await withTimeout(this.fallback.generate(req), this.timeoutMs, 'image generate (fallback)'),
        'fallback',
      );
    }
  }
}
