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
    defineField({ name: 'summary', type: 'string', description: 'One line under the title, e.g. "Residential: architecture, archviz, virtual tour"' }),
    defineField({
      name: 'brief',
      title: 'The brief',
      type: 'text', rows: 5,
      description: 'The first of the two paragraphs in the project page\'s left column. Who it was for, what they needed, and what made it hard. Two or three sentences.',
    }),
    defineField({ name: 'whatWeDid', title: 'What we did', type: 'text', rows: 5,
      description: 'The second paragraph. How it was tackled and what was delivered; end on the result if there is one worth stating. The services list below is shown separately, at the foot of the column.' }),
    defineField({ name: 'liveUrl', title: 'Live link', type: 'url',
      description: 'Where the finished thing lives, if it lives anywhere public. Leave empty and the button is not shown.' }),
    defineField({
      name: 'services',
      title: 'Services',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'The list in the project page\'s left column. Empty falls back to the studio\'s own services.',
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'cover',
      type: 'image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text' })],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'media',
      title: 'Media',
      description:
        'The project page, top to bottom: stills and clips in one list, in the order they should be read. Nothing is cropped — each one keeps the shape it was made in.',
      type: 'array',
      of: [
        {
          type: 'image',
          title: 'Image',
          options: { hotspot: true },
          fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text' })],
        },
        {
          type: 'object',
          name: 'clip',
          title: 'Video',
          fields: [
            defineField({ name: 'file', type: 'file', title: 'Video file',
              description: 'Silent, and it loops. Keep it under ~10MB: 1080p, no audio track.',
              options: { accept: 'video/mp4,video/webm' } }),
            defineField({ name: 'url', type: 'url', title: 'Or a URL',
              description: 'Used when there is no uploaded file.' }),
            defineField({ name: 'poster', type: 'image', title: 'Poster frame',
              description: 'Shown until the clip is on screen and playing. It also sets how much room the page holds open, so give it the clip\'s own shape.',
              options: { hotspot: true } }),
            defineField({ name: 'alt', type: 'string', title: 'Alt text' }),
          ],
          preview: { select: { title: 'alt', media: 'poster' } },
        },
      ],
      options: { layout: 'grid' },
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery (old)',
      description: 'Only read when Media above is empty. Put new work in Media.',
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
