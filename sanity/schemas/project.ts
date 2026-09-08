import { defineField, defineType } from 'sanity';

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: (r) => r.required() }),
    defineField({ name: 'year', type: 'number' }),
    defineField({ name: 'location', type: 'string' }),
    defineField({
      name: 'studios',
      title: 'Studios involved',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Architecture + Design', value: 'architecture' },
          { title: 'Creative Media', value: 'media' },
          { title: 'Digital Products', value: 'products' },
        ],
        layout: 'grid',
      },
    }),
    defineField({ name: 'summary', type: 'string', description: 'One line under the title, e.g. "Residential — architecture, archviz, virtual tour"' }),
    defineField({
      name: 'cover',
      type: 'image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text' })],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'gallery',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true }, fields: [{ name: 'alt', type: 'string', title: 'Alt text' }] }],
    }),
    defineField({ name: 'body', title: 'Story', type: 'array', of: [{ type: 'block' }] }),
    defineField({ name: 'featured', type: 'boolean', initialValue: false }),
    defineField({ name: 'order', type: 'number', description: 'Lower comes first on the Work page' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'summary', media: 'cover' },
  },
});
