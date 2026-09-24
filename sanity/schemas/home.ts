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
        defineField({ name: 'lead', title: 'Hand-off line', type: 'string', initialValue: 'Here is how that happens.',
          description: 'The one line under the statement that the video section answers.' }),
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
      name: 'studios',
      title: 'Three studios',
      type: 'object',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: 'Studios' }),
        defineField({ name: 'title', type: 'string', initialValue: 'Three studios.' }),
        defineField({ name: 'intro', type: 'text', rows: 2 }),
        defineField({
          name: 'items',
          type: 'array',
          description: 'One panel each, in this order. The key ties it to the work filter and must be one of: architecture, media, products.',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'key', type: 'string', options: { list: ['architecture', 'media', 'products'] }, validation: (r) => r.required() }),
              defineField({ name: 'name', type: 'string', validation: (r) => r.required() }),
              defineField({ name: 'promise', type: 'string', description: 'The one line at the top right of the panel.' }),
              defineField({ name: 'description', type: 'text', rows: 4 }),
              defineField({ name: 'services', title: 'What we do', type: 'array', of: [{ type: 'string' }] }),
            ],
            preview: { select: { title: 'name', subtitle: 'promise' } },
          }],
        }),
      ],
    }),
    defineField({
      name: 'brands',
      title: 'Clients',
      type: 'object',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: 'Clients we work with' }),
        defineField({
          name: 'items',
          type: 'array',
          description: 'Upload the mark in a single colour. The site flips it for the dark background.',
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
      description: 'One at a time, on a reel. The words are the client\'s, so do not edit them for length.',
      fields: [
        defineField({ name: 'tag', title: 'Heading', type: 'string', initialValue: 'Client stories' }),
        defineField({
          name: 'items',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'label', type: 'string',
                description: 'What the chooser on the left calls this one: a word from the quote itself. Falls back to the name.' }),
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
    defineField({
      name: 'work',
      title: 'Selected work',
      type: 'object',
      description: 'The pile of cards under the client stories. At least seven projects, or the pile cannot be thrown.',
      fields: [
        defineField({ name: 'tag', title: 'Note at the top', type: 'text', rows: 2, description: 'Two short lines; a line break here is kept.' }),
        defineField({ name: 'title', type: 'string', initialValue: 'Case studies.' }),
        defineField({ name: 'intro', type: 'string', description: 'The line under the title.' }),
        defineField({ name: 'featured', title: 'Projects, in order', type: 'array', of: [{ type: 'reference', to: [{ type: 'project' }] }] }),
        defineField({ name: 'cta', title: 'Button', ...cta }),
      ],
    }),
    defineField({
      name: 'faqs',
      title: 'FAQs',
      type: 'object',
      fields: [
        defineField({ name: 'tag', type: 'string', initialValue: 'FAQs' }),
        defineField({ name: 'title', type: 'string' }),
        defineField({ name: 'aside', title: 'Line beside the founder', type: 'text', rows: 2, description: 'A line break here is kept.' }),
        defineField({ name: 'cta', title: 'Button', ...cta }),
        defineField({
          name: 'items',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'q', title: 'Question', type: 'string' }),
              defineField({ name: 'a', title: 'Answer', type: 'text', rows: 5, description: 'Leave a blank line between paragraphs.' }),
            ],
            preview: { select: { title: 'q' } },
          }],
        }),
      ],
    }),
    defineField({ name: 'featuredProject', title: 'Featured project (hero)', type: 'reference', to: [{ type: 'project' }] }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
});
