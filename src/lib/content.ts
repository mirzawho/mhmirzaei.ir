import { getCollection, render, type CollectionEntry } from 'astro:content';
import fs from 'node:fs';
import path from 'node:path';

const AUTHOR = 'Mohammad Hossein Mirzaei';
const CONTENT_ROOT = path.resolve('src/content');
const THUMBNAIL_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
const FAVICON_EXTENSIONS = ['ico', 'svg', 'png', 'webp', 'jpg', 'jpeg'] as const;
const PUBLIC_ROOT = path.resolve('public');
const LOGO_EXTENSIONS = ['png', 'svg', 'webp', 'jpg', 'jpeg'] as const;

/** Words rendered fully uppercase, regardless of source casing. */
const TECHNOLOGIES_UPPERCASE_WORDS: Record<string, string> = {
  api: 'API',
  cli: 'CLI',
  css: 'CSS',
  html: 'HTML',
  js: 'JS',
  json: 'JSON',
  sql: 'SQL',
  ui: 'UI',
  ux: 'UX',
  xml: 'XML',
};

/** Compound keys split at these suffixes ("tailwindcss" -> "tailwind css"); ui/ux omitted so words like "redux"/"flux" stay whole. */
const TECHNOLOGIES_COMPOUND_SUFFIXES = [
  'api',
  'cli',
  'css',
  'html',
  'js',
  'json',
  'sql',
  'xml',
];

const techWords = (value: string): string[] =>
  value
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .flatMap((word) => {
      const lower = word.toLowerCase();
      const suffix = TECHNOLOGIES_COMPOUND_SUFFIXES.find(
        (s) => lower.length > s.length && lower.endsWith(s),
      );
      return suffix
        ? [word.slice(0, -suffix.length), word.slice(-suffix.length)]
        : [word];
    });

const formatTechText = (words: string[]): string =>
  words
    .map(
      (word) =>
        TECHNOLOGIES_UPPERCASE_WORDS[word.toLowerCase()] ??
        `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(' ');

const thumbnailUrls = import.meta.glob<string>(
  '/src/content/**/thumbnail.*',
  { eager: true, query: '?url', import: 'default' },
);

const faviconUrls = import.meta.glob<string>(
  '/src/content/**/favicon.*',
  { eager: true, query: '?url', import: 'default' },
);

/** Content sections, each a folder under `src/content/`. */
export type TContentType = 'blog' | 'project';

export type IContent = {
  slug: string;
  title: string;
  description: string;
  category?: string;
  tags: string[];
  thumbnail?: string;
  favicon?: string;
  publishedAt: Date;
  author: string;
  content?: any;
};

export type IContentBlog = IContent;

export type TWorkStatus = 'in-progress' | 'done' | 'canceled';

export type IContentTechnology = {
  text: string;
  image: string | null;
};

export type IContentProject = IContent & {
  technologies: IContentTechnology[];
  start_at: string;
  end_at?: string;
  members: number;
  status: TWorkStatus;
};

/** Localized status labels, keyed by locale. */
export const PROJECT_STATUS_LABELS: Record<TWorkStatus, Record<string, string>> = {
  'in-progress': { fa: 'در حال انجام', en: 'In progress' },
  done: { fa: 'انجام شد', en: 'Done' },
  canceled: { fa: 'لغو شد', en: 'Canceled' },
};

export const PROJECT_STATUS_COLORS: Record<TWorkStatus, string> = {
  'in-progress': 'badge-warning',
  done: 'badge-success',
  canceled: 'badge-error',
};

export class MirzaContent<T extends IContent = IContent> {
  private readonly folderName: TContentType;

  constructor(folderName: TContentType = 'blog') {
    this.folderName = folderName;
  }

  private findThumbnailUrl(locale: string, slug: string): string | undefined {
    for (const ext of THUMBNAIL_EXTENSIONS) {
      const key = `/src/content/${this.folderName}/${locale}/${slug}/thumbnail.${ext}`;
      if (thumbnailUrls[key]) return thumbnailUrls[key];
    }
    return undefined;
  }

  private findFaviconUrl(locale: string, slug: string): string | undefined {
    for (const ext of FAVICON_EXTENSIONS) {
      const key = `/src/content/${this.folderName}/${locale}/${slug}/favicon.${ext}`;
      if (faviconUrls[key]) return faviconUrls[key];
    }
    return undefined;
  }

  private getPublishedAt(locale: string, slug: string): Date {
    const contentPath = path.join(
      CONTENT_ROOT,
      this.folderName,
      locale,
      slug,
      'content.md',
    );
    return fs.statSync(contentPath).mtime;
  }

  private resolveTechnologies(keys: string[]): IContentTechnology[] {
    return keys.map((key) => {
      const words = techWords(key);
      const slug = words.map((word) => word.toLowerCase()).join('_');
      let image: string | null = null;
      for (const ext of LOGO_EXTENSIONS) {
        const url = `/images/logos/${slug}.${ext}`;
        if (fs.existsSync(path.join(PUBLIC_ROOT, url))) {
          image = url;
          break;
        }
      }
      return { text: formatTechText(words), image };
    });
  }

  private async entryToPost(
    entry: CollectionEntry<TContentType>,
    content = false,
  ): Promise<T> {
    const [locale, ...slugParts] = entry.id.split('/');
    const slug = slugParts.join('/');
    const rawTechnologies = (entry.data as { technologies?: string[] })
      .technologies;

    const post = {
      ...entry.data,
      ...(rawTechnologies
        ? { technologies: this.resolveTechnologies(rawTechnologies) }
        : {}),
      slug,
      thumbnail: this.findThumbnailUrl(locale ?? '', slug),
      favicon: this.findFaviconUrl(locale ?? '', slug),
      publishedAt: this.getPublishedAt(locale ?? '', slug),
      author: AUTHOR,
    } as T;

    if (content) {
      const { Content } = await render(entry);
      post.content = Content;
    }

    return post;
  }

  public async posts(locale: string): Promise<T[]> {
    const entries = await getCollection(this.folderName);
    const posts: T[] = [];

    for (const entry of entries) {
      if (!entry.id.startsWith(`${locale}/`)) continue;
      posts.push(await this.entryToPost(entry));
    }

    return posts.sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    );
  }

  public async post(locale: string, slug: string): Promise<T | null> {
    const entries = await getCollection(this.folderName);
    const entry = entries.find((e) => e.id === `${locale}/${slug}`);
    if (!entry) return null;
    return this.entryToPost(entry, true);
  }

  public async slugs(locale: string): Promise<string[]> {
    const entries = await getCollection(this.folderName);
    const prefix = `${locale}/`;
    return entries
      .filter((e) => e.id.startsWith(prefix))
      .map((e) => e.id.slice(prefix.length));
  }
}

export default MirzaContent;
