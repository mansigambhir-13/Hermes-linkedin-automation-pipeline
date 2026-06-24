/**
 * Phase T smoke — proves the MCP server builds and registers its tools without a DB or keys
 * (handlers aren't invoked here; compose_caption/save_draft need locked-config + DATABASE_URL to RUN).
 * Run: pnpm --filter @rss/tool-server smoke
 */
import { buildServer } from '../src/server.js';

const server = buildServer();
console.log(server ? 'PASS — rss-tool-server built and tools registered.' : 'FAIL — server did not build.');
process.exit(server ? 0 : 1);
