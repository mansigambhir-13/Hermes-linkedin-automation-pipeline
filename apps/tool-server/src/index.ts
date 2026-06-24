import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';

/**
 * Entry point — runs the RSS Tool Server over stdio (how Hermes' MCP client connects).
 * Register this server with Hermes in Phase H.
 */
const server = buildServer();
const transport = new StdioServerTransport();
await server.connect(transport);
