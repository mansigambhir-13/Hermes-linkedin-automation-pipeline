import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PutResult {
  key: string;
}

/**
 * Pluggable object store. Images are private at rest; a (transiently) public URL is minted on
 * demand and freshly at publish time for Instagram's public-URL requirement (06 §A5/§B5).
 */
export interface ObjectStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<PutResult>;
  url(key: string, ttlSeconds?: number): Promise<string>;
}

/** Dev default: local filesystem, no AWS/Docker. URL is a file:// URL. Also where eval artifacts land. */
export class LocalObjectStore implements ObjectStore {
  constructor(private readonly baseDir: string = process.env.LOCAL_ARTIFACTS_DIR ?? '.artifacts') {}

  async put(key: string, bytes: Uint8Array, _contentType: string): Promise<PutResult> {
    const full = join(this.baseDir, key);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
    return { key };
  }

  async url(key: string): Promise<string> {
    return pathToFileURL(resolve(this.baseDir, key)).href;
  }
}

/** Production: S3 with presigned GET URLs. Wired when S3 creds are available (staging/prod). */
export class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly bucket: string = requiredEnv('S3_BUCKET')) {
    const region = process.env.S3_REGION;
    this.client = new S3Client(region ? { region } : {});
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<PutResult> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
    return { key };
  }

  async url(key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}

/**
 * Supabase Storage backend (raw REST — no SDK dep). Uploads via the service-role key; serves a PERMANENT
 * public URL (the bucket is public), so there's no presign/expiry to worry about. Portable across machines
 * and Render. Constructor is lenient — it only validates creds when an upload/url is actually requested,
 * so a text-only deploy (no media) works even before the service-role key is set.
 */
export class SupabaseObjectStore implements ObjectStore {
  private readonly base: string; // https://<ref>.supabase.co/storage/v1
  private readonly bucket: string;
  private readonly key: string; // service_role key

  constructor() {
    const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    this.base = url ? `${url}/storage/v1` : '';
    this.bucket = process.env.SUPABASE_BUCKET || 'post-media';
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  }

  private assertConfigured(): void {
    if (!this.base || !this.key) {
      throw new Error('Supabase Storage needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (and a public SUPABASE_BUCKET).');
    }
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<PutResult> {
    this.assertConfigured();
    const res = await fetch(`${this.base}/object/${this.bucket}/${encodeURI(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': contentType, 'x-upsert': 'true' },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Supabase Storage upload failed (${res.status}): ${await res.text()}`);
    return { key };
  }

  async url(key: string): Promise<string> {
    this.assertConfigured();
    return `${this.base}/object/public/${this.bucket}/${encodeURI(key)}`;
  }
}

export function createObjectStore(): ObjectStore {
  switch (process.env.OBJECT_STORE ?? 'local') {
    case 'supabase':
      return new SupabaseObjectStore();
    case 's3':
      return new S3ObjectStore();
    default:
      return new LocalObjectStore();
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}
