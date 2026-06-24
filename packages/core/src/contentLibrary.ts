import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sanitizeCaption } from './text.js';
import { getDb } from './db.js';
import type { PublishPlatform } from './schemas.js';

/**
 * Content library = the finished, pre-made posts the team supplies. Hermes does NOT author these;
 * it lists them so a human can pick one, then the pick flows into the normal review → publish pipeline.
 *
 * Two backends behind one interface:
 *   - FolderLibrary    — reads the `Sample content ` folder (caption MD + image PNG). Works with no DB.
 *   - SupabaseLibrary  — reads the `library_posts` table (db/0003). Needs DATABASE_URL.
 * Select with CONTENT_LIBRARY=folder|supabase (default folder).
 */
export interface LibraryPost {
  id: string;
  title: string;
  platform: PublishPlatform;
  pillar?: string;
  slot?: string; // human-readable scheduled slot from the MD (e.g. "Mon 2026-06-01, 9:00am IST")
  caption: string; // sanitized, ready-to-publish (CTA/hashtags already inside the source)
  /** X multi-tweet thread (each tweet sanitized, in order). Present only for thread posts. */
  thread?: string[];
  /** True if the post cannot ship without an image (IG always; image-essential X/LinkedIn cards). */
  mediaRequired?: boolean;
  imagePath?: string; // local file path (folder backend)
  imageKey?: string; // storage key / url (db backend)
  altText?: string;
}

export interface ContentLibrary {
  list(): Promise<LibraryPost[]>;
  get(id: string): Promise<LibraryPost | undefined>;
}

const CONTENT_DIR = process.env.CONTENT_LIBRARY_DIR || 'content/ready'; // a file here = publishable

/** Platform from the filename first (most reliable: `-linkedin-`/`-x-`/`-instagram-`), then title/**Platform:** line. */
function detectPlatform(file: string, title: string, platLine: string): PublishPlatform {
  const hay = `${file} ${title} ${platLine}`.toLowerCase();
  if (/\binstagram\b|\big\b/.test(hay)) return 'instagram';
  if (/(^|[-\s])x([-\s]|$)|\btwitter\b/.test(hay)) return 'x';
  return 'linkedin';
}

/** Body of the first matching `## <heading>` section (until the next `##`). */
function sectionBody(md: string, headings: string[]): string | undefined {
  for (const h of headings) {
    const m = new RegExp(`^##\\s+${h}\\s*$`, 'im').exec(md);
    if (m) {
      const rest = md.slice(m.index + m[0].length);
      const next = /^##\s+/m.exec(rest);
      return rest.slice(0, next ? next.index : undefined);
    }
  }
  return undefined;
}

/** Pull only the leading blockquote (`> …`) out of a section, stopping at the first non-quote line. */
function extractQuote(section: string): string {
  const out: string[] = [];
  let started = false;
  for (const line of section.split('\n')) {
    if (/^\s*>/.test(line)) {
      started = true;
      out.push(line.replace(/^\s*>\s?/, ''));
    } else if (started) {
      break; // quote ended — ignore trailing notes (**Char count**, ---, etc.)
    }
  }
  return out.join('\n').trim();
}

/** X thread: capture every tweet under `**N/M**` markers (each a `>` blockquote). ≥2 tweets → a thread. */
function extractThread(md: string): string[] | undefined {
  const tweets: string[] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^\*\*\d+\s*\/\s*\d+\*\*\s*$/.test(lines[i]!.trim())) continue;
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === '') j++; // skip a blank line after the marker
    const buf: string[] = [];
    while (j < lines.length && /^\s*>/.test(lines[j]!)) {
      buf.push(lines[j]!.replace(/^\s*>\s?/, ''));
      j++;
    }
    const t = buf.join('\n').trim();
    if (t) tweets.push(sanitizeCaption(t));
  }
  return tweets.length >= 2 ? tweets : undefined;
}

/** A post is media-required if it can't ship without an image: IG always; X/LinkedIn cards whose Format names a non-optional image. */
function detectMediaRequired(md: string, platform: PublishPlatform): boolean {
  if (platform === 'instagram') return true;
  const fmt = (/^\*\*Format:\*\*\s*(.+)$/im.exec(md)?.[1] ?? '').toLowerCase();
  if (!/\b(image|card|carousel)\b/.test(fmt)) return false;
  return !/\boptional\b/.test(fmt); // "Optional … image" ⇒ not required
}

function parseMd(dir: string, file: string): LibraryPost {
  const md = readFileSync(join(dir, file), 'utf8');
  const id = file.replace(/\.md$/, '');
  const title = (/^#\s+(.+)$/m.exec(md)?.[1] ?? id).trim();
  const platLine = /^\*\*Platform:\*\*\s*(.+)$/im.exec(md)?.[1] ?? '';
  const platform = detectPlatform(file, title, platLine);
  const pillar = (/^\*\*Pillar:\*\*\s*(.+)$/im.exec(md)?.[1] ?? '').split('·')[0]?.split('(')[0]?.trim() || undefined;
  const slot = /^\*\*Slot:\*\*\s*(.+)$/im.exec(md)?.[1]?.trim() || undefined;

  // Thread first (X). Else the single body under a recognised heading (incl. ## TWEET / ## TWEET CAPTION).
  const thread = extractThread(md);
  const section = sectionBody(md, ['Suggested caption', 'TWEET CAPTION', 'POST COPY', 'CAPTION', 'TWEET', 'POST', 'What it means \\(brand voice\\)']) ?? md;
  const single = sanitizeCaption(extractQuote(section) || section.trim());
  const caption = thread ? thread.join('\n\n') : single; // display/fallback; X publishing uses thread[]
  const mediaRequired = detectMediaRequired(md, platform);

  const png = join(dir, `${id}.png`);
  // Absolute path — the local object store resolves storage keys against .artifacts, so a relative path would break publish.
  return { id, title, platform, pillar, slot, caption, thread, mediaRequired, imagePath: existsSync(png) ? resolve(png) : undefined };
}

export class FolderLibrary implements ContentLibrary {
  constructor(private readonly dir: string = CONTENT_DIR) {}
  async list(): Promise<LibraryPost[]> {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .sort((a, b) => b.localeCompare(a)) // most-recent-first (dated filenames sort newest → oldest)
      .map((f) => parseMd(this.dir, f));
  }
  async get(id: string): Promise<LibraryPost | undefined> {
    return (await this.list()).find((p) => p.id === id);
  }
}

interface LibraryRow {
  id: string;
  title: string;
  platform: string;
  pillar: string | null;
  slot: string | null;
  caption: string;
  thread: string[] | null;
  media_required: boolean | null;
  image_key: string | null;
  alt_text: string | null;
}

function fromRow(r: LibraryRow): LibraryPost {
  return {
    id: r.id,
    title: r.title,
    platform: (['linkedin', 'instagram', 'x'].includes(r.platform) ? r.platform : 'linkedin') as PublishPlatform,
    pillar: r.pillar ?? undefined,
    slot: r.slot ?? undefined,
    caption: sanitizeCaption(r.caption),
    thread: r.thread ?? undefined,
    mediaRequired: r.media_required ?? undefined,
    imageKey: r.image_key ?? undefined,
    altText: r.alt_text ?? undefined,
  };
}

const COLS = 'id, title, platform, pillar, slot, caption, thread, media_required, image_key, alt_text';

export class SupabaseLibrary implements ContentLibrary {
  async list(): Promise<LibraryPost[]> {
    const sql = getDb();
    const rows = (await sql.unsafe(`select ${COLS} from library_posts order by created_at desc`)) as unknown as LibraryRow[];
    return rows.map(fromRow);
  }
  async get(id: string): Promise<LibraryPost | undefined> {
    const sql = getDb();
    const rows = (await sql`select id, title, platform, pillar, slot, caption, thread, media_required, image_key, alt_text from library_posts where id = ${id} limit 1`) as unknown as LibraryRow[];
    return rows[0] ? fromRow(rows[0]) : undefined;
  }
}

export function createContentLibrary(): ContentLibrary {
  return (process.env.CONTENT_LIBRARY ?? 'folder') === 'supabase' ? new SupabaseLibrary() : new FolderLibrary();
}
