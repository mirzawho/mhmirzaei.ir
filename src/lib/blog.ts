import { getCollection, render, type CollectionEntry } from 'astro:content';
import fs from 'node:fs';
import path from 'node:path';

const AUTHOR = 'Mohammad Hossein Mirzaei';
const CONTENT_ROOT = path.resolve('src/content');
const THUMBNAIL_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

const thumbnailUrls = import.meta.glob<string>(
  '/src/content/**/thumbnail.*',
  { eager: true, query: '?url', import: 'default' },
);

export type IBlogPost = {
  slug: string;
  title: string;
  description: string;
  category?: string;
  tags: string[];
  thumbnail?: string;
  publishedAt: Date;
  author: string;
  content?: any;
};

function findThumbnailUrl(locale: string, slug: string): string | undefined {
  for (const ext of THUMBNAIL_EXTENSIONS) {
    const key = `/src/content/${locale}/${slug}/thumbnail.${ext}`;
    if (thumbnailUrls[key]) return thumbnailUrls[key];
  }
  return undefined;
}

function getPublishedAt(locale: string, slug: string): Date {
  const contentPath = path.join(CONTENT_ROOT, locale, slug, 'content.md');
  return fs.statSync(contentPath).mtime;
}

async function entryToPost(
  entry: CollectionEntry<'blog'>,
  content = false,
): Promise<IBlogPost> {
  const [locale, ...slugParts] = entry.id.split('/');
  const slug = slugParts.join('/');

  const post: IBlogPost = {
    slug,
    title: entry.data.title,
    description: entry.data.description,
    category: entry.data.category,
    tags: entry.data.tags,
    thumbnail: findThumbnailUrl(locale, slug),
    publishedAt: getPublishedAt(locale, slug),
    author: AUTHOR,
  };

  if (content) {
    const { Content } = await render(entry);
    post.content = Content;
  }

  return post;
}

async function getPosts(locale: string): Promise<IBlogPost[]> {
  const entries = await getCollection('blog');
  const posts: IBlogPost[] = [];

  for (const entry of entries) {
    if (!entry.id.startsWith(`${locale}/`)) continue;
    posts.push(await entryToPost(entry));
  }

  return posts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

async function getPost(
  locale: string,
  slug: string,
): Promise<IBlogPost | null> {
  const entries = await getCollection('blog');
  const entry = entries.find((e) => e.id === `${locale}/${slug}`);
  if (!entry) return null;
  return entryToPost(entry, true);
}

async function getPostSlugs(locale: string): Promise<string[]> {
  const entries = await getCollection('blog');
  return entries
    .filter((e) => e.id.startsWith(`${locale}/`))
    .map((e) => e.id.split('/').slice(1).join('/'));
}


export default {
    posts: getPosts,
    post: getPost,
    slugs: getPostSlugs,
}