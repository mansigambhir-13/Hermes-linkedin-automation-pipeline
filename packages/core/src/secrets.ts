/**
 * Pluggable secrets provider (06 §B11). Dev reads from process.env (loaded from .env);
 * AWS Secrets Manager impl lands in Phase 5. Never commit secrets to the repo.
 */
export interface SecretsProvider {
  get(name: string): Promise<string | undefined>;
}

export class EnvSecretsProvider implements SecretsProvider {
  async get(name: string): Promise<string | undefined> {
    return process.env[name];
  }
}

export function createSecretsProvider(): SecretsProvider {
  return new EnvSecretsProvider();
}
