import { experimental_generateImage as generateImage } from 'ai';
import type { GenerateRequest, GenerateResult, ImageModelAdapter } from '../types.js';

/**
 * Renders via AI Gateway — the model is a plain 'provider/model' string, routed by the gateway.
 * Requires AI_GATEWAY_API_KEY in the environment. This is the production adapter.
 */
export class GatewayImageAdapter implements ImageModelAdapter {
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const { image } = await generateImage({
      model: req.model,
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    });
    return {
      bytes: image.uint8Array,
      mediaType: image.mediaType ?? 'image/png',
      modelUsed: req.model,
    };
  }
}
