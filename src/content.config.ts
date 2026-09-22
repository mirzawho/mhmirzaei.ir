import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({
    pattern: '**/content.md',
    base: './src/content',
    generateId: ({ entry }) => entry.replace(/\/content\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
