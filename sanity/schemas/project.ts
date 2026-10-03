import { defineField, defineType } from 'sanity';
import { CaseIcon } from '@sanity/icons/Case';
import { orderRankField } from '@sanity/orderable-document-list';

const STUDIOS = [
  { title: 'Architecture + Design', value: 'architecture' },
  { title: 'Creative Media', value: 'media' },
  { title: 'Digital Products', value: 'products' },
];

/* One project: its page at /work/<slug>, its card on the Work page, and —
   if it is picked on the Homepage — a card in the Case studies pile. The tabs
   follow the page: what it is, what was done, what it looks like, where it
   leads. The order of projects is set by dragging them in the Projects list. */
export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: CaseIcon,
  groups: [
    { name: 'basics', title: 'Basics', default: true },
    { name: 'text', title: 'Text' },
    { name: 'media', title: 'Pictures & video' },
    { name: 'links', title: 'Buttons' },
    { name: 'seo', title: 'Search & sharing' },
  ],
  fields: [
    // the place in the Projects list, set by dragging there
    orderRankField({ type: 'project' }),

    defineField({ name: 'title', type: 'string', group: 'basics', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Web address', type: 'slug', group: 'basics', options: { source: 'title' },
      description: 'The end of the project\'s address: immrsv.studio/work/… Press Generate to make it from the title.',
      validation: (r) => r.required() }),
    defineField({
      name: 'studios',
      title: 'Studio',
      group: 'basics',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: STUDIOS, layout: 'grid' },
      description: 'Which studio it belongs to: the first one ticked decides the Work page filter and which studio\'s pictures it appears among.',
      validation: (r) => r.min(1).error('Tick at least one studio.'),
    }),
    defineField({ name: 'summary', title: 'Line under the title', type: 'string', group: 'basics',
      description: 'One line, e.g. "Residential: architecture, archviz, virtual tour".' }),

    defineField({
      name: 'brief',
      title: 'The brief',
      group: 'text',
      type: 'text', rows: 5,
      description: 'The first of the two paragraphs on the project page. Who it was for, what they needed, and what made it hard. Two or three sentences.',
    }),
    defineField({ name: 'whatWeDid', title: 'What we did', group: 'text', type: 'text', rows: 5,
      description: 'The second paragraph. How it was tackled and what was delivered; end on the result if there is one worth stating.' }),
    defineField({
      name: 'services',
      title: 'Services',
      group: 'text',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'The small tags under the text, e.g. "Permits". Type one and press Enter. Empty, the studio\'s own list is used.',
      options: { layout: 'tags' },
    }),

    defineField({
      name: 'cover',
      title: 'Cover',
      group: 'media',
      type: 'image',
      options: { hotspot: true },
      description: 'The picture on the project\'s card, on the Work page and in the Case studies pile.',
      fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text', description: 'A few words on what the picture shows, for people who cannot see it.' })],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'media',
      title: 'Pictures & video',
      group: 'media',
      description:
        'The project page, top to bottom: pictures and videos in one list; drag to reorder. Nothing is cropped — each keeps its own shape.',
      type: 'array',
      of: [
        {
          type: 'image',
          title: 'Picture',
          options: { hotspot: true },
          fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text' })],
        },
        {
          type: 'object',
          name: 'clip',
          title: 'Video',
          fields: [
            defineField({ name: 'file', type: 'file', title: 'Video file',
              description: 'Silent, and it loops. Keep it under ~10MB: 1080p, no sound.',
              options: { accept: 'video/mp4,video/webm' } }),
            defineField({ name: 'url', type: 'url', title: 'Or a link to the video file',
              description: 'Only when there is no uploaded file.' }),
            defineField({ name: 'poster', type: 'image', title: 'Still frame',
              description: 'Shown until the video plays. Use a frame from the video itself, same shape.',
              options: { hotspot: true } }),
            defineField({ name: 'alt', type: 'string', title: 'Alt text' }),
          ],
          preview: { select: { title: 'alt', media: 'poster' }, prepare: ({ title, media }) => ({ title: title || 'Video', media }) },
        },
      ],
      options: { layout: 'grid' },
    }),

    defineField({
      name: 'links',
      title: 'Buttons',
      group: 'links',
      type: 'array',
      validation: (r) => r.max(3),
      description: 'Buttons on the project page, e.g. "Visit website" or "Watch the film". Up to three; drag to reorder. Leave empty for none.',
      of: [{
        type: 'object',
        options: { columns: 2 },
        fields: [
          defineField({ name: 'label', title: 'Text', type: 'string', validation: (r) => r.required() }),
          defineField({ name: 'url', title: 'Link', type: 'url', validation: (r) => r.required() }),
        ],
        preview: { select: { title: 'label', subtitle: 'url' } },
      }],
    }),
    defineField({
      name: 'seo', title: 'Search & sharing', type: 'seo', group: 'seo',
      description: 'Fills itself in: the title is the project\'s name, the description is its line under the title (or the start of The brief), the picture is its cover. Change any of them only if the automatic one is not right.',
    }),
    defineField({ name: 'liveUrl', title: 'Live link (old)', type: 'url', group: 'links', hidden: ({ value }) => !value,
      description: 'Replaced by Buttons above. Still shown as a "View live" button until Buttons is filled in.' }),

  ],
  preview: {
    select: { title: 'title', studio: 'studios.0', media: 'cover' },
    prepare: ({ title, studio, media }) => ({
      title,
      subtitle: STUDIOS.find((s) => s.value === studio)?.title,
      media,
    }),
  },
});
