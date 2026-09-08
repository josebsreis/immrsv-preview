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
      title: 'Statement panel',
      type: 'object',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: 'What we do' }),
        defineField({ name: 'statement', type: 'text', rows: 6, description: 'Leave a blank line between paragraphs.' }),
        defineField({
          name: 'founder',
          title: 'Signed by',
          type: 'object',
          fields: [
            defineField({ name: 'name', type: 'string' }),
            defineField({ name: 'role', type: 'string' }),
            defineField({ name: 'portrait', type: 'image', options: { hotspot: true } }),
          ],
        }),
        defineField({
          name: 'stats',
          title: 'Figures',
          description: 'Shown one at a time, advancing on their own. Leave empty to hide the reel.',
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
      ],
    }),
    defineField({
      name: 'brands',
      title: 'Brands',
      type: 'object',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: "Brands we've helped" }),
        defineField({
          name: 'items',
          type: 'array',
          description: 'Upload the mark in a single colour — the site flips it for the dark background.',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'name', type: 'string' }),
              defineField({ name: 'logo', type: 'image' }),
            ],
            preview: { select: { title: 'name', media: 'logo' } },
          }],
        }),
      ],
    }),
    defineField({ name: 'featuredProject', type: 'reference', to: [{ type: 'project' }] }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
});
