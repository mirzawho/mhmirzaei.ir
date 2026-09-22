/**
 * Generates `public/robots.txt` for the site.
 *
 * All public pages (including the blog and every locale) are crawlable; the
 * only directives are the allow-all policy and a pointer to the sitemap.
 * The sitemap URL is derived from the same canonical site origin that
 * `sitemap.ts` uses, so the two files can never disagree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveSiteUrl } from './site';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public/robots.txt');

export function generateRobotsTxt(siteUrl: string): string {
	return ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export function writeRobotsTxt(): void {
	const siteUrl = resolveSiteUrl();
	fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
	fs.writeFileSync(OUTPUT_PATH, generateRobotsTxt(siteUrl), 'utf8');
	console.log(`Generated ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

const invokedAsScript =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
	writeRobotsTxt();
}
