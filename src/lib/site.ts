/**
 * Single source of truth for the canonical site origin.
 *
 * Resolution order: `SITE_URL` environment variable, then `site` in
 * `astro.config.mjs`. Sitemap and robots generation run as standalone Node
 * scripts (outside Astro), so the config file is read and parsed directly
 * rather than imported. SEO imports the same resolver, keeping every
 * generated URL on one canonical origin.
 */
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

export function resolveSiteUrl(): string {
	const raw = process.env.SITE_URL ?? readConfiguredSite();
	if (!raw) {
		throw new Error(
			'No site URL found. Set `site` in astro.config.mjs or the SITE_URL environment variable.',
		);
	}
	const url = new URL(raw);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`Site URL must be a http(s) URL, got: ${raw}`);
	}
	// Keep an explicit non-default port; drop trailing slashes and any path.
	const basePath = url.pathname.replace(/\/+$/, '');
	return `${url.protocol}//${url.host}${basePath}`;
}

function readConfigSource(): string | undefined {
	// When this module is bundled by Astro (e.g. seo.ts in the prerender
	// chunks), `import.meta.dirname` points inside `dist/`, so also try the
	// working directory, which is the project root for npm scripts and CI.
	for (const dir of [PROJECT_ROOT, process.cwd()]) {
		const configPath = path.join(dir, 'astro.config.mjs');
		if (!fs.existsSync(configPath)) continue;
		return fs.readFileSync(configPath, 'utf8');
	}
	return undefined;
}

function readConfiguredSite(): string | undefined {
	const source = readConfigSource();
	if (!source) return undefined;
	// The config is plain ESM with a single `site` property; a regex read
	// avoids importing it (which would pull in the Astro Vite toolchain).
	const match = source.match(/site:\s*['"]([^'"]+)['"]/);
	return match?.[1];
}

export interface I18nConfig {
	readonly locales: readonly string[];
	readonly defaultLocale: string | undefined;
	readonly prefixDefaultLocale: boolean;
}

/**
 * Read the i18n block from `astro.config.mjs` with the same regex approach as
 * `resolveSiteUrl`. Falls back to a single unprefixed locale when the config
 * has no `i18n` section.
 */
export function resolveI18nConfig(): I18nConfig {
	const source = readConfigSource();
	const localesBlock = source?.match(/locales:\s*\[([^\]]*)\]/)?.[1];
	const locales = localesBlock
		? [...localesBlock.matchAll(/['"]([^'"]*)['"]/g)]
			.map((match) => match[1])
			.filter((locale) => locale.length > 0)
		: [];
	if (locales.length === 0) {
		return { locales: [''], defaultLocale: undefined, prefixDefaultLocale: false };
	}
	const defaultLocale = source?.match(/defaultLocale:\s*['"]([^'"]+)['"]/)?.[1];
	const prefixDefaultLocale =
		source?.match(/prefixDefaultLocale:\s*(true|false)/)?.[1] === 'true';
	return { locales, defaultLocale: defaultLocale ?? locales[0], prefixDefaultLocale };
}
