/**
 * Minimal AI Gateway connectivity check. Reads AI_GATEWAY_API_KEY from the environment
 * (load via: node --env-file=.env --import tsx packages/image/scripts/verify-gateway.ts).
 * Prints only OK / the short reply / an error — never the key.
 */
import { generateText } from 'ai';

const model = 'anthropic/claude-haiku-4.5'; // cheapest valid text model for a connectivity ping

try {
  const { text } = await generateText({ model, prompt: 'Reply with exactly: OK' });
  console.log(`AI Gateway reachable via ${model} — reply: "${text.trim().slice(0, 16)}"`);
  process.exit(0);
} catch (e) {
  console.error('AI Gateway call FAILED:', e instanceof Error ? e.message : String(e));
  process.exit(1);
}
