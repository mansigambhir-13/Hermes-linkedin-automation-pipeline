/**
 * Production runtime hardening — shared by the bot and the worker.
 *  - installProcessGuards: keep the process alive on stray errors (log, don't crash), and shut down
 *    cleanly on SIGTERM/SIGINT (so a host's deploy/restart doesn't sever connections mid-flight).
 *  - requireEnv: fail fast at startup with a clear report if required config is missing.
 */

type ShutdownFn = () => void | Promise<void>;
const shutdownFns: ShutdownFn[] = [];
let shuttingDown = false;

/** Register a cleanup to run on SIGTERM/SIGINT (close sockets, DB pools, HTTP servers). */
export function onShutdown(fn: ShutdownFn): void {
  shutdownFns.push(fn);
}

async function runShutdown(label: string, signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${label}] ${signal} received — shutting down gracefully…`);
  const timer = setTimeout(() => {
    console.error(`[${label}] shutdown timed out — forcing exit.`);
    process.exit(1);
  }, 10_000);
  timer.unref();
  for (const fn of shutdownFns) {
    try {
      await fn();
    } catch (e) {
      console.error(`[${label}] shutdown step failed:`, e);
    }
  }
  clearTimeout(timer);
  console.log(`[${label}] clean shutdown complete.`);
  process.exit(0);
}

/**
 * Install process-level guards. Logs (does not crash) on uncaughtException / unhandledRejection so a single
 * stray error never takes the whole bot/worker down — the opposite of the EADDRINUSE-style hard crash.
 */
export function installProcessGuards(label: string): void {
  process.on('unhandledRejection', (reason) => {
    console.error(`[${label}] unhandledRejection:`, reason instanceof Error ? reason.stack : reason);
  });
  process.on('uncaughtException', (err) => {
    console.error(`[${label}] uncaughtException (kept alive):`, err?.stack ?? err);
  });
  process.on('SIGTERM', () => void runShutdown(label, 'SIGTERM'));
  process.on('SIGINT', () => void runShutdown(label, 'SIGINT'));
}

export interface EnvSpec {
  /** Required vars — startup aborts (with a readable report) if any are missing/empty. */
  required: string[];
  /** Optional vars — reported as present/absent but never fatal. */
  optional?: string[];
}

/**
 * Validate environment at startup. Prints a present/missing report (never the values) and throws if a
 * required var is missing — so deployments fail loudly at boot, not cryptically mid-publish.
 */
export function requireEnv(label: string, spec: EnvSpec): void {
  const isSet = (k: string): boolean => typeof process.env[k] === 'string' && process.env[k]!.trim() !== '';
  const missing = spec.required.filter((k) => !isSet(k));
  const lines: string[] = [`[${label}] config check:`];
  for (const k of spec.required) lines.push(`  ${isSet(k) ? '✅' : '❌'} ${k} (required)`);
  for (const k of spec.optional ?? []) lines.push(`  ${isSet(k) ? '✅' : '·'} ${k} (optional)`);
  console.log(lines.join('\n'));
  if (missing.length) {
    throw new Error(`[${label}] missing required env: ${missing.join(', ')}. Set them in .env (local) or the host's env (prod).`);
  }
}
