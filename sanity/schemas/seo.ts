import { defineField, defineType } from 'sanity';

/* What a page says about itself to search engines and when its link is
   shared. Every part is worked out by the site on its own — the title from
   the page's name, the description from its own words, the picture from its
   own pictures — so this is only for when the automatic one is not right.
   Each description says what is used when the field is left empty. */
export const seo = defineType({
  name: 'seo',
  title: 'Search & sharing',
  type: 'object',
  options: { collapsible: false },
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'The blue link in Google and the bold line when shared. Leave empty for the automatic one (the page\'s name, then "| IMMRSV"). Under 60 characters.',
      validation: (r) => r.max(60).warning('Over 60 characters, Google cuts it short.'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text', rows: 3,
      description: 'The grey text under the link in Google, and under the title when shared. Leave empty for the automatic one (taken from the page\'s own text). Around 150 characters.',
      validation: (r) => r.max(160).warning('Over 160 characters, Google cuts it short.'),
    }),
    defineField({
      name: 'image',
      title: 'Picture when shared',
      type: 'image',
      options: { hotspot: true },
      description: 'Shown when the link is sent in a message or posted. Cropped to 1200 × 630; set the focus point to keep what matters. Leave empty for the automatic one (the page\'s own cover, or the site\'s picture in Menu & footer).',
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines',
      type: 'boolean',
      initialValue: false,
      description: 'Turn on to keep this page out of Google. It can still be opened by anyone with the link.',
    }),
  ],
});
