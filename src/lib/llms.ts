/**
 * Generates `public/llms.txt`, a curated Markdown map of the site for AI
 * systems, following the proposal at https://llmstxt.org/.
 *
 * Like `sitemap.ts`, this runs as a standalone Node script during the build,
 * so it cannot reuse `src/lib/blog.ts`: that module depends on Astro's
 * virtual `astro:content` module. Blog posts are therefore read from the
 * same `src/content/` layout and frontmatter schema that `content.config.ts`
 * defines, and page titles/descriptions come from each page's `seo` prop,
 * keeping those files the single source of truth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveI18nConfig, resolveSiteUrl, type I18nConfig } from './site';
import { SITE } from './seo';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'src/pages');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'src/content');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public/llms.txt');

/**
 * Upper bound on blog entries, keeping llms.txt concise; the sitemap stays
 * the exhaustive URL index.
 */
const MAX_BLOG_ENTRIES = 50;

interface LinkEntry {
  title: string;
  url: string;
  description?: string;
}

interface PostEntry extends LinkEntry {
  publishedAt: number;
}

export function generateLlmsTxt(): string {
  const siteUrl = resolveSiteUrl();
  const i18n = resolveI18nConfig();

  const pages: LinkEntry[] = [];
  const blogIndexes: LinkEntry[] = [];
  const posts: PostEntry[] = [];

  for (const locale of i18n.locales) {
    const base = `${siteUrl}${localePrefix(locale, i18n)}`;
    pages.push(...collectLocalePages(locale, base));
    collectBlog(locale, `${base}/blog`, blogIndexes, posts);
  }
  // Newest first, like `blog.ts`; the URL tiebreak keeps output deterministic.
  posts.sort((a, b) => b.publishedAt - a.publishedAt || a.url.localeCompare(b.url));

  return buildDocument(siteUrl, i18n, pages, blogIndexes, posts);
}

/** URL path prefix for a locale, honoring `prefixDefaultLocale`. */
function localePrefix(locale: string, i18n: I18nConfig): string {
  if (locale === '' || locale === i18n.defaultLocale) {
    return i18n.prefixDefaultLocale ? `/${locale}` : '';
  }
  return `/${locale}`;
}

function collectLocalePages(locale: string, base: string): LinkEntry[] {
  const dir = locale === '' ? PAGES_DIR : path.join(PAGES_DIR, locale);
  if (!fs.existsSync(dir)) return [];

  const entries: LinkEntry[] = [];
  if (fs.existsSync(path.join(dir, 'index.astro'))) {
    entries.push(pageEntry(path.join(dir, 'index.astro'), base));
  }
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (item) =>
        item.isFile() &&
        item.name.endsWith('.astro') &&
        item.name !== 'index.astro' &&
        !item.name.startsWith('_'),
    )
    .map((item) => item.name.replace(/\.astro$/, ''))
    .sort();
  for (const name of names) {
    entries.push(pageEntry(path.join(dir, `${name}.astro`), `${base}/${name}`));
  }
  return entries;
}

function pageEntry(filePath: string, url: string): LinkEntry {
  const source = fs.readFileSync(filePath, 'utf8');
  return {
    title: readSeoString(source, 'title') ?? fallbackTitle(filePath),
    url,
    description: readSeoString(source, 'description'),
  };
}

function fallbackTitle(filePath: string): string {
  const name = path.basename(filePath, '.astro');
  if (name === 'index') return SITE.name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Read a string value from a page's `seo` prop; the value may sit on the next line. */
function readSeoString(source: string, key: string): string | undefined {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]?.match(new RegExp(`^\\s*${key}:\\s*(.*)$`));
    if (!match) continue;
    const inline = match[1]?.trim() ?? '';
    if (inline) return unquote(inline);
    const next = lines[i + 1] ?? '';
    return /^\s*["']/.test(next) ? unquote(next) : undefined;
  }
  return undefined;
}

function collectBlog(
  locale: string,
  blogBase: string,
  indexes: LinkEntry[],
  posts: PostEntry[],
): void {
  const pagesDir = locale === '' ? PAGES_DIR : path.join(PAGES_DIR, locale);
  // Articles are only routable when the locale has a blog section.
  if (!fs.existsSync(path.join(pagesDir, 'blog'))) return;

  const indexPage = path.join(pagesDir, 'blog', 'index.astro');
  if (fs.existsSync(indexPage)) indexes.push(pageEntry(indexPage, blogBase));

  const contentDir = path.join(CONTENT_DIR, locale);
  if (!fs.existsSync(contentDir)) return;
  for (const { slug, mtime } of collectContentSlugs(contentDir)) {
    const meta = readPostMeta(path.join(contentDir, slug, 'content.md'));
    posts.push({
      title: meta.title ?? slug,
      description: meta.description,
      url: `${blogBase}/${slug}`,
      publishedAt: mtime.getTime(),
    });
  }
}

/** Same content layout walk as `sitemap.ts`: `<locale>/<slug>/content.md`. */
function collectContentSlugs(
  dir: string,
  base = '',
): { slug: string; mtime: Date }[] {
  const slugs: { slug: string; mtime: Date }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      slugs.push(...collectContentSlugs(path.join(dir, entry.name), relative));
    } else if (entry.name === 'content.md' && base) {
      slugs.push({
        slug: base,
        mtime: fs.statSync(path.join(dir, entry.name)).mtime,
      });
    }
  }
  return slugs;
}

/** Minimal frontmatter reader for the flat schema in `content.config.ts`. */
function readPostMeta(filePath: string): { title?: string; description?: string } {
  const block = fs
    .readFileSync(filePath, 'utf8')
    .match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block?.[1]) return {};
  const lines = block[1].split(/\r?\n/);
  const meta: { title?: string; description?: string } = {};
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]?.match(/^(title|description):\s*(.*)$/);
    if (!match) continue;
    const key = match[1] as 'title' | 'description';
    const inline = match[2]?.trim() ?? '';
    const next = lines[i + 1] ?? '';
    meta[key] = inline ? unquote(inline) : /^\s*["']/.test(next) ? unquote(next) : undefined;
  }
  return meta;
}

function unquote(value: string): string {
  // Drop the trailing comma of object-literal syntax before unquoting.
  const trimmed = value.trim().replace(/,\s*$/, '');
  const match = trimmed.match(/^"(.*)"$/) ?? trimmed.match(/^'(.*)'$/);
  return match?.[1] ? match[1].replaceAll('\\"', '"') : trimmed;
}

function buildDocument(
  siteUrl: string,
  i18n: I18nConfig,
  pages: LinkEntry[],
  blogIndexes: LinkEntry[],
  posts: PostEntry[],
): string {
  const shownPosts = posts.slice(0, MAX_BLOG_ENTRIES);
  const languages = i18n.locales
    .filter((locale) => locale !== '')
    .map((locale) => languageName(locale));

  // The file framing is English (llms.txt convention); the localized page
  // titles and descriptions below stay in their own language.
  const blockquote = [
    SITE.defaultDescription.en,
    languages.length > 0 ? `Available in ${formatList(languages)}.` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(' ');

  // Derive the section overview from the pages actually found; home pages
  // (single URL segment) are not sections.
  const sectionNames = [
    ...new Set([
      ...pages
        .map((page) => page.url.slice(siteUrl.length).split('/').filter(Boolean))
        .filter((segments) => segments.length > 1)
        .map((segments) => segments[segments.length - 1] ?? ''),
      ...(blogIndexes.length > 0 ? ['blog'] : []),
    ]),
  ]
    .filter((name) => name.length > 0)
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));

  const context =
    sectionNames.length > 0 ? `Main sections: ${formatList(sectionNames)}.` : undefined;

  const blogEntries: LinkEntry[] = [...blogIndexes, ...shownPosts];
  const truncated = posts.length > shownPosts.length;

  const sections = [
    `# ${SITE.name}`,
    `> ${blockquote}`,
    context,
    renderSection('Pages', pages),
    renderSection(
      'Blog',
      blogEntries,
      truncated
        ? `Showing the ${shownPosts.length} most recent articles; the complete list of URLs is available in the sitemap.`
        : undefined,
    ),
    renderSection('Optional', [
      {
        title: 'Sitemap',
        url: `${siteUrl}/sitemap.xml`,
        description: 'Exhaustive machine-readable list of all public URLs.',
      },
    ]),
  ].filter((section) => section !== undefined && section !== '');

  return `${sections.join('\n\n')}\n`;
}

function renderSection(
  heading: string,
  entries: LinkEntry[],
  note?: string,
): string | undefined {
  if (entries.length === 0) return undefined;
  const lines = entries.map(renderLink);
  if (note) lines.push(note);
  return [`## ${heading}`, ...lines].join('\n');
}

function renderLink(entry: LinkEntry): string {
  const description = entry.description
    ? `: ${escapeMarkdownText(entry.description)}`
    : '';
  return `- [${escapeMarkdownText(entry.title)}](${encodeUrl(entry.url)})${description}`;
}

/** Collapse whitespace and escape characters that would break Markdown link text. */
function escapeMarkdownText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');
}

/** Percent-encode anything that could break the URL or the Markdown link. */
function encodeUrl(url: string): string {
  return encodeURI(url).replaceAll('(', '%28').replaceAll(')', '%29');
}

function formatList(items: readonly string[]): string {
  return new Intl.ListFormat('en', { type: 'conjunction' }).format(items);
}

function languageName(locale: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) || locale;
  } catch {
    return locale;
  }
}

export function writeLlmsTxt(): void {
  const content = generateLlmsTxt();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
  console.log(`Generated ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  writeLlmsTxt();
}
