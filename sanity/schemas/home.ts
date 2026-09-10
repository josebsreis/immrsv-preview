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
    defineField({
      name: 'testimonials',
      title: 'Client stories',
      type: 'object',
      description: 'One at a time, on a reel. The words are the client\'s — do not edit them for length.',
      fields: [
        defineField({ name: 'tag', title: 'Heading', type: 'string', initialValue: 'Client stories' }),
        defineField({
          name: 'items',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'label', type: 'string',
                description: 'What the chooser on the left calls this one — a word from the quote itself. Falls back to the name.' }),
              defineField({ name: 'quote', type: 'text', rows: 5 }),
              defineField({ name: 'name', type: 'string' }),
              defineField({ name: 'role', type: 'string', description: 'e.g. "Principal | Wolcott Architecture"' }),
              defineField({ name: 'portrait', type: 'image', options: { hotspot: true },
                fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text' })] }),
            ],
            preview: { select: { title: 'name', subtitle: 'role', media: 'portrait' } },
          }],
        }),
      ],
    }),
    defineField({
      name: 'process',
      title: 'How we work',
      type: 'object',
      description: 'Read one step at a time as the section is scrolled. Three or four steps; more and the bar has nothing left to say between them.',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: 'Our process' }),
        defineField({ name: 'title', type: 'string', initialValue: 'How we work' }),
        defineField({ name: 'intro', type: 'text', rows: 2, description: 'A line break here is kept.' }),
        defineField({
          name: 'steps',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'title', type: 'string' }),
              defineField({ name: 'body', type: 'text', rows: 4 }),
            ],
            preview: { select: { title: 'title', subtitle: 'body' } },
          }],
        }),
      ],
    }),
    defineField({ name: 'featuredProject', type: 'reference', to: [{ type: 'project' }] }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
});
