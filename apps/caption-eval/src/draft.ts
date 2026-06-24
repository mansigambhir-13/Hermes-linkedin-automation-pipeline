/**
 * Drafting moved to the shared @rss/agent package (used by the caption gate, the aligned-posts script, and
 * the Slack pipeline). Re-exported here so the existing scripts (`../src/draft.js`) keep working unchanged.
 */
export * from '@rss/agent';
