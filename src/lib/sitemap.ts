/**
 * Generates `public/sitemap.xml` from the actual project structure.
 *
 * Runs as a standalone Node script during the build, so it cannot reuse
 * `src/lib/blog.ts`: that module depends on Astro's virtual `astro:content`
 * module, which only exists inside the Astro build pipeline. Blog slugs are
 * therefore derived from the same `src/content/` layout that the collection
 * loader in `content.config.ts` uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveSiteUrl } from './site';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'src/pages');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'src/content');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public/sitemap.xml');

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export async function generateSitemap(): Promise<void> {
  const siteUrl = resolveSiteUrl();
  const entries = collectEntries(siteUrl);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, buildXml(entries), 'utf8');
  console.log(
    `Generated ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} with ${entries.length} URLs`,
  );
}

function collectEntries(siteUrl: string): SitemapEntry[] {
  const homes: SitemapEntry[] = [];
  const staticPages: SitemapEntry[] = [];
  const blogIndexes: SitemapEntry[] = [];

  for (const route of collectPageRoutes(PAGES_DIR).sort((a, b) => a.route.localeCompare(b.route))) {
    const entry: SitemapEntry = {
      loc: siteUrl + route.route,
      lastmod: route.lastmod.toISOString(),
    };
    const segments = route.route.split('/').filter(Boolean);
    if (segments.length <= 1) {
      homes.push(entry);
    } else if (segments.length === 2 && segments[1] === 'blog') {
      blogIndexes.push(entry);
    } else {
      staticPages.push(entry);
    }
  }

  return [
    ...homes,
    ...staticPages,
    ...blogIndexes,
    ...collectBlogEntries(siteUrl),
  ];
}

function collectPageRoutes(
  dir: string,
  base = '',
): { route: string; lastmod: Date }[] {
  const routes: { route: string; lastmod: Date }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // `_`-prefixed files are not routes in Astro; dotfiles never are either.
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      routes.push(...collectPageRoutes(path.join(dir, entry.name), relative));
      continue;
    }
    if (!/\.(astro|md)$/.test(entry.name)) continue;
    // Dynamic route files ([slug].astro) only define a pattern; the concrete
    // URLs come from the content collection.
    if (relative.split('/').some((segment) => segment.startsWith('['))) continue;
    // Pages that only redirect elsewhere are not indexable.
    if (isRedirectPage(path.join(dir, entry.name))) continue;
    const filePath = path.join(dir, entry.name);
    routes.push({
      route: routeFromFilePath(relative),
      lastmod: fs.statSync(filePath).mtime,
    });
  }
  return routes;
}

function isRedirectPage(filePath: string): boolean {
  return fs.readFileSync(filePath, 'utf8').includes('Astro.redirect(');
}

function routeFromFilePath(relative: string): string {
  const withoutExtension = relative.replace(/\.(astro|md)$/, '');
  const withoutIndex = withoutExtension.replace(/\/?index$/, '');
  // Ensure trailing slash so the sitemap matches Astro's default
  // trailing-slash redirect behaviour and avoids 301s.
  return withoutIndex === '' ? '/' : `/${withoutIndex}/`;
}

function collectBlogEntries(siteUrl: string): SitemapEntry[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const entries: SitemapEntry[] = [];
  for (const locale of listContentLocales()) {
    // Articles are only routable when the locale has a blog section.
    if (!fs.existsSync(path.join(PAGES_DIR, locale, 'blog'))) continue;
    for (const { slug, mtime } of collectContentSlugs(
      path.join(CONTENT_DIR, locale),
    )) {
      entries.push({
        // Trailing slash matches the canonical URL after Astro's redirect.
        loc: `${siteUrl}/${locale}/blog/${slug}/`,
        // Same date source as `publishedAt` in blog.ts.
        lastmod: mtime.toISOString(),
      });
    }
  }
  return entries.sort((a, b) => a.loc.localeCompare(b.loc));
}

function listContentLocales(): string[] {
  return fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

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

function buildXml(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) =>
    [
      '  <url>',
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      ...(entry.lastmod ? [`    <lastmod>${entry.lastmod}</lastmod>`] : []),
      '  </url>',
    ].join('\n'),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  generateSitemap().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
