import { defineArrayMember, defineField, defineType } from 'sanity';

/** What every page shares: how to reach the studio, where to follow it, and
 *  what the footer says. One document, edited in one place. */
export const settings = defineType({
  name: 'settings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'description',
      title: 'Default description',
      type: 'text', rows: 2,
      description: 'Shown by search engines and when a page is shared, for any page that has no description of its own.',
    }),
    defineField({
      name: 'contact',
      type: 'object',
      fields: [
        defineField({ name: 'email', type: 'string', description: 'e.g. hello@immrsv.studio' }),
        defineField({ name: 'phone', type: 'string', description: 'As it should read, e.g. 747.302.6868. The link to call it is made from the digits, with +1 in front.' }),
      ],
    }),
    defineField({
      name: 'footer',
      type: 'object',
      fields: [
        defineField({
          name: 'words', title: 'Rotating words', type: 'array', of: [{ type: 'string' }],
          description: 'The last word of "Let\'s create something …". The first is the resting word. Include the full stop.',
        }),
        defineField({
          name: 'buttons', type: 'array', validation: (r) => r.max(2),
          description: 'The two buttons under the invitation, e.g. "Discuss your project" and "Book a call". A link can be a web address, mailto:… or tel:….',
          of: [defineArrayMember({
            type: 'object',
            fields: [
              defineField({ name: 'label', type: 'string', validation: (r) => r.required() }),
              defineField({ name: 'href', title: 'Link', type: 'string', validation: (r) => r.required() }),
            ],
            preview: { select: { title: 'label', subtitle: 'href' } },
          })],
        }),
        defineField({ name: 'location', type: 'string', description: 'The line under Location, e.g. "Working globally from Los Angeles, California."' }),
        defineField({ name: 'city', title: 'City beside the clock', type: 'string', description: 'The clock itself keeps Los Angeles time.' }),
        defineField({
          name: 'social', title: 'Follow', type: 'array',
          of: [defineArrayMember({
            type: 'object',
            fields: [
              defineField({ name: 'label', type: 'string', description: 'e.g. Instagram', validation: (r) => r.required() }),
              defineField({ name: 'url', type: 'url', validation: (r) => r.required() }),
            ],
            preview: { select: { title: 'label', subtitle: 'url' } },
          })],
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Site settings' }) },
});
