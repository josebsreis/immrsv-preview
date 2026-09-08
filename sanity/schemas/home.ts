import { defineField, defineType } from 'sanity';

const cta = {
  type: 'object',
  fields: [
    defineField({ name: 'label', type: 'string' }),
    defineField({ name: 'href', type: 'string' }),
  ],
};

export const home = defineType({
  name: 'home',
  title: 'Homepage',
  type: 'document',
  fields: [
    defineField({
      name: 'hero',
      type: 'object',
      fields: [
        defineField({ name: 'headline', type: 'text', rows: 2, description: 'Use a line break before the rotating word, e.g. "Designing the future\\nof"' }),
        defineField({ name: 'words', title: 'Rotating words', type: 'array', of: [{ type: 'string' }], description: 'First is the resting word. Include the full stop.' }),
        defineField({ name: 'description', type: 'text', rows: 3 }),
        defineField({ name: 'primaryCta', title: 'Primary button', ...cta }),
        defineField({ name: 'secondaryCta', title: 'Secondary button', ...cta }),
      ],
    }),
    defineField({
      name: 'about',
      type: 'object',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: 'About' }),
        defineField({ name: 'statement', type: 'text', rows: 3 }),
        defineField({ name: 'caps', title: 'Three lines (caps)', type: 'text', rows: 3 }),
        defineField({ name: 'body', type: 'text', rows: 4 }),
        defineField({ name: 'cta', title: 'Button', ...cta }),
        defineField({
          name: 'facts',
          title: 'Facts row',
          description: 'A figure and what it counts. Four reads best; leave empty to hide the row.',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'value', type: 'string' }),
              defineField({ name: 'label', type: 'string' }),
            ],
            preview: { select: { title: 'value', subtitle: 'label' } },
          }],
        }),
        defineField({
          name: 'principles',
          title: 'Positions',
          description: 'Numbered automatically. Three reads best; leave empty to hide the block.',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'title', type: 'string' }),
              defineField({ name: 'text', type: 'text', rows: 3 }),
            ],
            preview: { select: { title: 'title', subtitle: 'text' } },
          }],
        }),
      ],
    }),
    defineField({ name: 'featuredProject', type: 'reference', to: [{ type: 'project' }] }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
});
