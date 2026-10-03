import { defineArrayMember, defineField, defineType } from 'sanity';
import { CogIcon } from '@sanity/icons/Cog';

/** What every page shares: the menu at the top, the footer at the foot, and
 *  how to reach the studio. One document, edited in one place. */
export const settings = defineType({
  name: 'settings',
  title: 'Menu & footer',
  type: 'document',
  icon: CogIcon,
  groups: [
    { name: 'menu', title: 'Menu', default: true },
    { name: 'contact', title: 'Contact' },
    { name: 'footer', title: 'Footer' },
    { name: 'seo', title: 'Search & sharing' },
  ],
  fields: [
    defineField({
      name: 'nav',
      title: 'Menu',
      group: 'menu',
      type: 'array',
      validation: (r) => r.max(5),
      description: 'The buttons at the top right of every page, left to right; drag to reorder. Link to a page (/work), or to #contact to scroll down to the footer.',
      of: [defineArrayMember({
        type: 'object',
        options: { columns: 2 },
        fields: [
          defineField({ name: 'label', title: 'Text', type: 'string', validation: (r) => r.required() }),
          defineField({ name: 'href', title: 'Link', type: 'string', validation: (r) => r.required() }),
        ],
        preview: { select: { title: 'label', subtitle: 'href' } },
      })],
    }),

    defineField({
      name: 'contact',
      title: 'Contact',
      group: 'contact',
      description: 'Shown in the footer of every page, and used by the Privacy policy.',
      type: 'object',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'email', type: 'string', description: 'e.g. hello@immrsv.studio' }),
        defineField({ name: 'phone', type: 'string', description: 'Written as it should read, e.g. 747.302.6868. Tapping it calls the number.' }),
      ],
    }),

    defineField({
      name: 'footer',
      title: 'Footer',
      group: 'footer',
      description: 'The black band at the foot of every page.',
      type: 'object',
      options: { collapsible: false },
      fields: [
        defineField({
          name: 'words', title: 'Rotating word', type: 'array', of: [{ type: 'string' }],
          description: 'The last word of "Let\'s create something …", which keeps changing. The first is shown first. Include the full stop.',
        }),
        defineField({
          name: 'buttons', title: 'Buttons', type: 'array', validation: (r) => r.max(2),
          description: 'The two buttons under "Let\'s create something …". A link can be a web address (a booking page, say), mailto:… or tel:….',
          of: [defineArrayMember({
            type: 'object',
            options: { columns: 2 },
            fields: [
              defineField({ name: 'label', title: 'Text', type: 'string', validation: (r) => r.required() }),
              defineField({ name: 'href', title: 'Link', type: 'string', validation: (r) => r.required() }),
            ],
            preview: { select: { title: 'label', subtitle: 'href' } },
          })],
        }),
        defineField({ name: 'city', title: 'City beside the clock', type: 'string', description: 'The clock itself always keeps Los Angeles time.' }),
        defineField({ name: 'location', title: 'Location', type: 'string', description: 'The line under "Location", e.g. "Working globally from Los Angeles, California."' }),
        defineField({
          name: 'social', title: 'Follow', type: 'array',
          description: 'The links under "Follow". Drag to reorder.',
          of: [defineArrayMember({
            type: 'object',
            options: { columns: 2 },
            fields: [
              defineField({ name: 'label', title: 'Name', type: 'string', description: 'e.g. Instagram', validation: (r) => r.required() }),
              defineField({ name: 'url', title: 'Link', type: 'url', validation: (r) => r.required() }),
            ],
            preview: { select: { title: 'label', subtitle: 'url' } },
          })],
        }),
      ],
    }),

    defineField({
      name: 'description',
      title: 'Description for search and sharing',
      group: 'seo',
      type: 'text', rows: 2,
      description: 'The line Google shows under the site\'s name, and the one shown when a link is shared — for the homepage, and any page that has nothing of its own to say. Around 150 characters.',
      validation: (r) => r.max(160).warning('Over 160 characters, Google cuts it short.'),
    }),
    defineField({
      name: 'shareImage',
      title: 'Picture when shared',
      group: 'seo',
      type: 'image',
      options: { hotspot: true },
      description: 'Shown when a link to the site is sent or posted, for any page without a picture of its own (a project uses its cover). Cropped to 1200 × 630.',
    }),
  ],
  preview: { prepare: () => ({ title: 'Menu & footer' }) },
});
