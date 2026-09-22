/**
 * Centralized SEO for the site.
 *
 * A page calls `useSeo()` with plain data and receives everything the layout
 * needs to render `<head>` metadata and JSON-LD. Pages never write meta tags
 * or Schema.org objects themselves.
 *
 * Site-wide defaults live in `SITE` below; per-page values always win.
 */
import { resolveSiteUrl } from './site';

/** Site-wide defaults. The URL comes from the shared site resolver. */
export const SITE = {
	url: resolveSiteUrl(),
	name: 'MH Mirzaei',
	defaultDescription: {
		en: 'Personal website of Mohammad Hossein Mirzaei, software engineer.',
		fa: 'وب‌سایت شخصی محمد حسین میرزایی، برنامه‌نویس.',
	},
	defaultImage: '/me.png',
	author: {
		name: 'Mohammad Hossein Mirzaei',
		url: `${resolveSiteUrl()}/fa`,
	},
} as const;

export interface SeoImage {
	/** Absolute URL, or path starting with `/` resolved against the site URL. */
	readonly url: string;
	readonly alt?: string | undefined;
}

export interface SeoBreadcrumb {
	readonly name: string;
	/** Absolute URL, or path starting with `/` resolved against the site URL. */
	readonly url: string;
}

export interface SeoAlternate {
	/** BCP 47 language tag of the alternate page, e.g. `en` or `fa`. */
	readonly locale: string;
	readonly url: string;
}

export interface SeoAuthor {
	readonly name: string;
	readonly url?: string | undefined;
}

export interface UseSeoInput {
	/** Page title. Combined with the site name unless `absoluteTitle` is set. */
	readonly title?: string | undefined;
	/** Full `<title>` override; used verbatim, without the site name suffix. */
	readonly absoluteTitle?: string | undefined;
	readonly description?: string | undefined;
	/**
	 * Current page URL (`Astro.url`). Used to derive the canonical URL when
	 * `canonical` is not provided.
	 */
	readonly url?: URL | string | undefined;
	/** Canonical URL. Defaults to `url` without query string or fragment. */
	readonly canonical?: string | undefined;
	/** BCP 47 language tag of the page, e.g. `en` or `fa`. */
	readonly locale?: string | undefined;
	/** Open Graph type; defaults to `website`, use `article` for blog posts. */
	readonly type?: 'website' | 'article' | undefined;
	readonly image?: string | SeoImage | undefined;
	readonly noindex?: boolean | undefined;
	readonly nofollow?: boolean | undefined;
	readonly author?: string | SeoAuthor | undefined;
	readonly publishedAt?: Date | undefined;
	readonly updatedAt?: Date | undefined;
	/** Article section/category. Only used when `type` is `article`. */
	readonly section?: string | undefined;
	/** Article tags. Only used when `type` is `article`. */
	readonly tags?: readonly string[] | undefined;
	readonly breadcrumbs?: readonly SeoBreadcrumb[] | undefined;
	/** Alternate-language versions of this page. */
	readonly alternates?: readonly SeoAlternate[] | undefined;
	/** Override the site name used in titles and Open Graph. */
	readonly siteName?: string | undefined;
}

export interface SeoResult {
	/** Language tag for `<html lang>`. */
	readonly lang: string;
	/** Text direction for `<html dir>`, derived from the language tag. */
	readonly dir: 'ltr' | 'rtl';
	/** Final `<title>` text. */
	readonly title: string;
	/** Canonical URL of the page. */
	readonly canonical: string;
	/** Every `<meta>` and `<link>` tag, ready to render inside `<head>`. */
	readonly head: string;
	/** All JSON-LD graphs, safely serialized and ready to render in `<head>`. */
	readonly jsonLd: string;
}

/** RTL scripts to check the primary language subtag against. */
const RTL_LANGUAGES = new Set([
	'ar',
	'fa',
	'he',
	'ur',
	'yi',
	'peo',
	'sd',
	'ug',
	'ps',
	'ckb',
	'mzn',
	'pnb',
]);

function isRtl(locale: string): boolean {
	const primary = locale.split('-')[0]?.toLowerCase() ?? '';
	return RTL_LANGUAGES.has(primary);
}

/** Open Graph locales use underscore format, e.g. `en` -> `en_US`. */
const OG_REGION_DEFAULTS: Record<string, string> = {
	en: 'en_US',
	fa: 'fa_IR',
};

function toOpenGraphLocale(locale: string): string {
	const [language, region] = locale.replace(/-/g, '_').split('_');
	if (!language) return 'en_US';
	if (region) return `${language}_${region.toUpperCase()}`;
	return OG_REGION_DEFAULTS[language] ?? language;
}

function isAbsoluteUrl(value: string): boolean {
	return /^https?:\/\//i.test(value);
}

/**
 * Resolve a path or URL against the site URL. Keeps the site origin in one
 * place and prevents protocol-relative or double-slash mistakes.
 */
function toAbsoluteUrl(value: string, siteUrl: string): string {
	if (isAbsoluteUrl(value)) return value;
	const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
	const path = value.startsWith('/') ? value : `/${value}`;
	return `${base}${path}`;
}

/** Strip query string and fragment; collapse duplicate slashes in the path. */
function cleanPathname(pathname: string): string {
	const withoutQuery = pathname.split(/[?#]/)[0] ?? '/';
	return withoutQuery.replace(/\/{2,}/g, '/');
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	const cutoff = value.lastIndexOf(' ', maxLength - 1);
	return `${(cutoff > 0 ? value.slice(0, cutoff) : value.slice(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeDescription(description: string): string {
	return truncate(normalizeWhitespace(description), 160);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * Serialize JSON-LD safely: `<`, `>`, and U+2028/2029 inside strings would
 * otherwise terminate the script element or break JS string parsing.
 */
function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003c')
		.replaceAll('>', '\\u003e')
		.replaceAll('&', '\\u0026')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029');
}

function metaTag(name: string, content: string): string {
	return `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`;
}

function propertyTag(property: string, content: string): string {
	return `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`;
}

function linkTag(rel: string, href: string, hreflang?: string, type?: string): string {
	const hreflangAttribute = hreflang ? ` hreflang="${escapeHtml(hreflang)}"` : '';
	const typeAttribute = type ? ` type="${escapeHtml(type)}"` : '';
	return `<link rel="${escapeHtml(rel)}" href="${escapeHtml(href)}"${hreflangAttribute}${typeAttribute} />`;
}

function normalizeImage(image: string | SeoImage | undefined): SeoImage | undefined {
	if (!image) return undefined;
	if (typeof image === 'string') return { url: image };
	return image;
}

function normalizeAuthor(author: string | SeoAuthor | undefined): SeoAuthor | undefined {
	if (!author) return undefined;
	if (typeof author === 'string') return { name: author };
	return author;
}

function buildTitle(input: UseSeoInput, siteName: string): string {
	if (input.absoluteTitle !== undefined) return normalizeWhitespace(input.absoluteTitle);
	if (input.title === undefined) return siteName;
	const title = normalizeWhitespace(input.title);
	// Avoid doubling the site name when the caller already included it.
	if (title === siteName || title.endsWith(` | ${siteName}`)) return title;
	return `${title} | ${siteName}`;
}

function buildGraph(input: UseSeoInput, resolved: {
	siteUrl: string;
	siteName: string;
	locale: string;
	canonical: string;
	title: string;
	description: string;
	image: SeoImage | undefined;
	author: SeoAuthor;
}): Record<string, unknown> {
	const { siteUrl, siteName, locale, canonical, title, description, image, author } = resolved;
	const isArticle = input.type === 'article';

	const graph: { '@context': string; '@graph': Record<string, unknown>[] } = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				'@id': `${siteUrl}/#website`,
				url: siteUrl,
				name: siteName,
				description: input.description
					? normalizeDescription(input.description)
					: undefined,
				inLanguage: locale,
			},
		],
	};

	const authorNode: Record<string, unknown> = {
		'@type': 'Person',
		'@id': `${siteUrl}/#author`,
		name: author.name,
		url: author.url ?? siteUrl,
	};

	if (isArticle) {
		const article: Record<string, unknown> = {
			'@type': 'BlogPosting',
			'@id': `${canonical}#article`,
			url: canonical,
			headline: truncate(title, 110),
			isPartOf: { '@id': `${siteUrl}/#website` },
			author: { '@id': `${siteUrl}/#author` },
			mainEntityOfPage: canonical,
			inLanguage: locale,
		};
		if (description) article.description = description;
		if (image) article.image = toAbsoluteUrl(image.url, siteUrl);
		if (input.publishedAt) article.datePublished = input.publishedAt.toISOString();
		if (input.updatedAt) article.dateModified = input.updatedAt.toISOString();
		if (input.section) article.articleSection = input.section;
		if (input.tags && input.tags.length > 0) article.keywords = input.tags.join(', ');
		graph['@graph'].push(article);
	}

	if (input.breadcrumbs && input.breadcrumbs.length > 0) {
		graph['@graph'].push({
			'@type': 'BreadcrumbList',
			itemListElement: input.breadcrumbs.map((crumb, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: crumb.name,
				item: toAbsoluteUrl(crumb.url, siteUrl),
			})),
		});
	}

	graph['@graph'].push(authorNode);

	return graph;
}

export function useSeo(input: UseSeoInput = {}): SeoResult {
	const siteUrl = SITE.url;
	const siteName = input.siteName ?? SITE.name;
	const locale = input.locale ?? 'en';
	const isArticle = input.type === 'article';

	const title = buildTitle(input, siteName);
	const description = normalizeDescription(
		input.description
			?? SITE.defaultDescription[locale as keyof typeof SITE.defaultDescription]
			?? Object.values(SITE.defaultDescription)[0],
	);

	const image = normalizeImage(input.image) ?? { url: SITE.defaultImage };
	const author = normalizeAuthor(input.author) ?? { name: SITE.author.name, url: SITE.author.url };

	// Canonical: caller value, else the page URL minus query string, fragment,
	// and duplicate slashes. Fall back to the site root when no URL is given.
	const pageUrl = input.url ?? '';
	const canonical = input.canonical
		? toAbsoluteUrl(input.canonical, siteUrl)
		: pageUrl
			? `${siteUrl}${cleanPathname(new URL(pageUrl, siteUrl).pathname)}`
			: siteUrl;

	const ogType = isArticle ? 'article' : 'website';
	const ogLocale = toOpenGraphLocale(locale);
	const ogImageUrl = toAbsoluteUrl(image.url, siteUrl);

	const tags: string[] = [];

	tags.push(`<title>${escapeHtml(title)}</title>`);
	tags.push(metaTag('description', description));
	tags.push(linkTag('canonical', canonical));
	// Curated Markdown map of the site for AI systems (https://llmstxt.org).
	tags.push(linkTag('describedby', `${siteUrl}/llms.txt`, undefined, 'text/plain'));

	const robots = [
		input.noindex ? 'noindex' : 'index',
		input.nofollow ? 'nofollow' : 'follow',
	];
	tags.push(metaTag('robots', robots.join(', ')));

	tags.push(propertyTag('og:title', title));
	tags.push(propertyTag('og:description', description));
	tags.push(propertyTag('og:type', ogType));
	tags.push(propertyTag('og:url', canonical));
	tags.push(propertyTag('og:site_name', siteName));
	tags.push(propertyTag('og:locale', ogLocale));
	tags.push(propertyTag('og:image', ogImageUrl));
	if (image.alt) tags.push(propertyTag('og:image:alt', image.alt));

	if (isArticle) {
		if (input.publishedAt) {
			tags.push(propertyTag('article:published_time', input.publishedAt.toISOString()));
		}
		if (input.updatedAt) {
			tags.push(propertyTag('article:modified_time', input.updatedAt.toISOString()));
		}
		if (author.name) tags.push(propertyTag('article:author', author.name));
		if (input.section) tags.push(propertyTag('article:section', input.section));
		for (const tag of input.tags ?? []) {
			tags.push(propertyTag('article:tag', tag));
		}
	}

	// Twitter card type: summary_large_image when we have an image, else summary.
	tags.push(metaTag('twitter:card', 'summary_large_image'));
	tags.push(metaTag('twitter:title', title));
	tags.push(metaTag('twitter:description', description));
	tags.push(metaTag('twitter:image', ogImageUrl));
	if (image.alt) tags.push(metaTag('twitter:image:alt', image.alt));

	for (const alternate of input.alternates ?? []) {
		tags.push(
			linkTag('alternate', toAbsoluteUrl(alternate.url, siteUrl), alternate.locale),
		);
	}

	const graph = buildGraph(input, {
		siteUrl,
		siteName,
		locale,
		canonical,
		title,
		description,
		image,
		author,
	});

	const jsonLd = `<script type="application/ld+json">${serializeJsonLd(graph)}</script>`;

	return {
		lang: locale,
		dir: isRtl(locale) ? 'rtl' : 'ltr',
		title,
		canonical,
		head: tags.join('\n'),
		jsonLd,
	};
}
