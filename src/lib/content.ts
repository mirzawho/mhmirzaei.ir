import { getCollection, render, type CollectionEntry } from 'astro:content';
import fs from 'node:fs';
import path from 'node:path';

const AUTHOR = 'Mohammad Hossein Mirzaei';
const CONTENT_ROOT = path.resolve('src/content');
const THUMBNAIL_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
const FAVICON_EXTENSIONS = ['ico', 'svg', 'png', 'webp', 'jpg', 'jpeg'] as const;

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

export type IContentProject = IContent & {
  technologies: string[];
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

  private async entryToPost(
    entry: CollectionEntry<TContentType>,
    content = false,
  ): Promise<T> {
    const [locale, ...slugParts] = entry.id.split('/');
    const slug = slugParts.join('/');

    const post = {
      ...entry.data,
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
