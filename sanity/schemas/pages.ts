import { defineArrayMember, defineField, defineType } from 'sanity';

/** The Work page's own words; the projects on it are the Projects. */
export const workPage = defineType({
  name: 'workPage',
  title: 'Work page',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', description: 'The heading, e.g. "Selected works"' }),
    defineField({ name: 'description', type: 'text', rows: 2, description: 'For search engines and sharing.' }),
    defineField({ name: 'empty', title: 'When a studio has no work yet', type: 'string', description: 'e.g. "Nothing in this studio yet."' }),
  ],
  preview: { prepare: () => ({ title: 'Work page' }) },
});

/** A page of small print: the privacy policy, the terms of use. */
export const legalPage = defineType({
  name: 'legalPage',
  title: 'Legal page',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'updated', title: 'Last updated', type: 'date' }),
    defineField({ name: 'description', type: 'text', rows: 2, description: 'For search engines and sharing.' }),
    defineField({
      name: 'body', title: 'Text', type: 'array',
      of: [defineArrayMember({
        type: 'block',
        styles: [{ title: 'Paragraph', value: 'normal' }, { title: 'Heading', value: 'h2' }],
        lists: [{ title: 'Bullets', value: 'bullet' }],
        marks: {
          decorators: [{ title: 'Bold', value: 'strong' }, { title: 'Italic', value: 'em' }],
          annotations: [{
            name: 'link', type: 'object', title: 'Link',
            fields: [defineField({ name: 'href', type: 'string', title: 'Link', description: 'A web address, mailto:… or a page such as /terms' })],
          }],
        },
      })],
    }),
  ],
  preview: { select: { title: 'title' } },
});
