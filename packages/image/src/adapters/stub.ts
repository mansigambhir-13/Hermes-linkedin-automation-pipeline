import type { GenerateRequest, GenerateResult, ImageModelAdapter } from '../types.js';

// 1x1 transparent PNG — a valid placeholder image so the pipeline runs without the gateway key.
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Dev adapter — returns a placeholder image so we can verify the pipeline before the key lands. */
export class StubImageAdapter implements ImageModelAdapter {
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    return {
      bytes: Uint8Array.from(Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64')),
      mediaType: 'image/png',
      modelUsed: `stub:${req.model}`,
    };
  }
}
