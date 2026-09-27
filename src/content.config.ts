import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const baseShape = {
  title: z.string(),
  description: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
};

const projectShape = {
  ...baseShape,
  technologies: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((tech) => tech.trim())
        .filter(Boolean),
    ),
  start_at: z.string(),
  end_at: z.string().optional(),
  members: z.number().int().positive(),
  status: z.enum(['in-progress', 'done', 'canceled']),
};

/** One collection per folder under `src/content/`; ids are `<locale>/<slug>`. */
function contentLoader(folder: string) {
  return glob({
    pattern: `${folder}/**/content.md`,
    base: './src/content',
    generateId: ({ entry }) =>
      entry.replace(new RegExp(`^${folder}/`), '').replace(/\/content\.md$/, ''),
  });
}

const blog = defineCollection({
  loader: contentLoader('blog'),
  schema: z.object(baseShape),
});

const project = defineCollection({
  loader: contentLoader('project'),
  schema: z.object(projectShape),
});

export const collections = { blog, project };
