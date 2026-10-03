import { defineArrayMember, defineField, defineType } from 'sanity';
import { ThListIcon } from '@sanity/icons/ThList';
import { DocumentTextIcon } from '@sanity/icons/DocumentText';

/** The Work page's own words; the projects on it are the Projects. */
export const workPage = defineType({
  name: 'workPage',
  title: 'Work page',
  type: 'document',
  icon: ThListIcon,
  description: 'The page that lists every project, at /work. The projects themselves, and their order, are in Projects.',
  fields: [
    defineField({ name: 'title', title: 'Heading', type: 'string', description: 'e.g. "Selected works"' }),
    defineField({ name: 'empty', title: 'When a studio has no work yet', type: 'string', description: 'Shown when a filter has nothing in it, e.g. "Nothing in this studio yet."' }),
    defineField({ name: 'description', title: 'Description for search and sharing', type: 'text', rows: 2 }),
  ],
  preview: { prepare: () => ({ title: 'Work page' }) },
});

/** A page of small print: the privacy policy, the terms of use. */
export const legalPage = defineType({
  name: 'legalPage',
  title: 'Legal page',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'updated', title: 'Last updated', type: 'date', description: 'Change this whenever the text changes.' }),
    defineField({ name: 'description', title: 'Description for search and sharing', type: 'text', rows: 2 }),
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
