import { defineField, defineType } from 'sanity';
import { HomeIcon } from '@sanity/icons/Home';

/** a button: what it says, and where it goes */
const cta = {
  type: 'object',
  options: { columns: 2 },
  fields: [
    defineField({ name: 'label', title: 'Text', type: 'string' }),
    defineField({ name: 'href', title: 'Link', type: 'string', description: 'A page (/work), a section (#contact), a web address, or mailto:…' }),
  ],
};

/* The homepage, one tab per section, in the order they come down the page.
   One document, so the whole page is published at once; the tabs only say
   which part of it is in front of you. Every description says where on the
   page the words appear, so nobody has to guess. */
export const home = defineType({
  name: 'home',
  title: 'Homepage',
  type: 'document',
  icon: HomeIcon,
  groups: [
    { name: 'hero', title: '1 · Top of the page', default: true },
    { name: 'about', title: '2 · What we do' },
    { name: 'brands', title: '3 · Clients' },
    { name: 'team', title: '4 · Your team, extended' },
    { name: 'studios', title: '5 · Studios' },
    { name: 'testimonials', title: '6 · Client stories' },
    { name: 'work', title: '7 · Case studies' },
    { name: 'faqs', title: '8 · FAQs' },
    { name: 'seo', title: 'Search & sharing' },
  ],
  fields: [
    defineField({
      name: 'hero',
      title: 'Top of the page',
      description: 'The first screen: the big headline over the moving particles, the line on the right and the two buttons.',
      type: 'object', group: 'hero',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'headline', type: 'text', rows: 2,
          description: 'The words before the rotating one. Press Enter where the line should break, e.g. "Designing the future" ⏎ "of".' }),
        defineField({ name: 'words', title: 'Rotating words', type: 'array', of: [{ type: 'string' }],
          description: 'The last word of the headline, which keeps changing. The first one is shown when the page opens. Include the full stop.' }),
        defineField({ name: 'description', title: 'Line on the right', type: 'text', rows: 3 }),
        defineField({ name: 'primaryCta', title: 'First button', ...cta }),
        defineField({ name: 'secondaryCta', title: 'Second button', ...cta }),
      ],
    }),

    defineField({
      name: 'about',
      title: 'What we do',
      description: 'The dark section after the first screen: the statement read word by word, the figures on the left and who signs it.',
      type: 'object', group: 'about',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'tag', title: 'Small label', type: 'string', initialValue: 'What we do' }),
        defineField({ name: 'statement', type: 'text', rows: 6, description: 'Leave a blank line between paragraphs.' }),
        defineField({
          name: 'stats',
          title: 'Figures',
          description: 'Shown one at a time, changing on their own, e.g. "30+" · "projects delivered". Drag to reorder. Leave empty to hide them.',
          type: 'array',
          of: [{
            type: 'object',
            options: { columns: 2 },
            fields: [
              defineField({ name: 'value', title: 'Figure', type: 'string' }),
              defineField({ name: 'label', title: 'What it counts', type: 'string' }),
            ],
            preview: { select: { title: 'value', subtitle: 'label' } },
          }],
        }),
        defineField({
          name: 'founder',
          title: 'Signed by',
          description: 'Also the person shown beside the FAQs.',
          type: 'object',
          fields: [
            defineField({ name: 'name', type: 'string' }),
            defineField({ name: 'role', type: 'string', description: 'e.g. "Founder"' }),
            defineField({ name: 'portrait', type: 'image', options: { hotspot: true }, description: 'Square works best. It is shown in black and white.',
              fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text', description: 'A few words on what the picture shows, for people who cannot see it.' })] }),
          ],
        }),
        // not on the page any more; kept so nothing written in it is lost
        defineField({ name: 'lead', type: 'string', hidden: true }),
      ],
    }),

    defineField({
      name: 'brands',
      title: 'Clients',
      description: 'The row of client logos at the foot of the dark section. Six spaces; with fewer logos, some repeat as they change.',
      type: 'object', group: 'brands',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'tag', title: 'Heading', type: 'string', initialValue: 'Clients we work with' }),
        defineField({
          name: 'items',
          title: 'Logos',
          type: 'array',
          description: 'Upload each logo in one colour, ideally as an SVG. The site shows it in white on the dark background.',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'name', title: 'Client', type: 'string' }),
              defineField({ name: 'logo', type: 'image',
                fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text', description: 'Usually just the client\'s name.' })] }),
            ],
            preview: { select: { title: 'name', media: 'logo' } },
          }],
        }),
      ],
    }),

    defineField({
      name: 'team',
      title: 'Your team, extended',
      description: 'The section where the white circle opens and the figure is built, with cards passing either side. The film and the icons are fixed; the words are yours.',
      type: 'object', group: 'team',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'lead', title: 'Title, first half', type: 'string', initialValue: 'Your team,' }),
        defineField({ name: 'tail', title: 'Title, second half', type: 'string', initialValue: 'extended.' }),
        defineField({ name: 'note', title: 'Small note at the top', type: 'text', rows: 2, description: 'Two short lines. Press Enter between them.' }),
        defineField({
          name: 'steps',
          title: 'Cards',
          type: 'array',
          validation: (r) => r.max(6),
          description: 'Up to six, in order; drag to reorder. Each card keeps the icon of its place: 1 bars, 2 squares, 3 network, 4 concept, 5 gauge, 6 radar.',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'word', title: 'Title', type: 'string', description: 'Short: it is set in capitals, two lines at most.' }),
              defineField({ name: 'line', title: 'Text', type: 'text', rows: 3 }),
            ],
            preview: { select: { title: 'word', subtitle: 'line' } },
          }],
        }),
      ],
    }),

    defineField({
      name: 'studios',
      title: 'Studios',
      description: 'The three panels that stack as you scroll, each with its pictures, its line and what it does. The pictures come from that studio\'s projects.',
      type: 'object', group: 'studios',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'kicker', title: 'Small line over the heading', type: 'string', initialValue: 'How we help' }),
        defineField({ name: 'title', title: 'Heading', type: 'string', initialValue: 'Three studios.' }),
        defineField({
          name: 'items',
          title: 'The studios',
          type: 'array',
          description: 'One panel each, in this order; drag to reorder.',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'key', title: 'Which studio', type: 'string', validation: (r) => r.required(),
                description: 'Ties the panel to its projects and to the filter on the Work page.',
                options: { list: [
                  { title: 'Architecture + Design', value: 'architecture' },
                  { title: 'Creative Media', value: 'media' },
                  { title: 'Digital Products', value: 'products' },
                ] } }),
              defineField({ name: 'name', type: 'string', validation: (r) => r.required() }),
              defineField({ name: 'promise', title: 'One line', type: 'string', description: 'The line at the top right of the panel.' }),
              defineField({ name: 'description', type: 'text', rows: 4 }),
              defineField({ name: 'services', title: 'What we do', type: 'array', of: [{ type: 'string' }], description: 'The list on the right of the panel.' }),
            ],
            preview: { select: { title: 'name', subtitle: 'promise' } },
          }],
        }),
        // not on the page any more; kept so nothing written in them is lost
        defineField({ name: 'tag', type: 'string', hidden: true }),
        defineField({ name: 'intro', type: 'text', hidden: true }),
      ],
    }),

    defineField({
      name: 'testimonials',
      title: 'Client stories',
      description: 'One quote at a time, changing on its own, with the client\'s name and picture. The words are the client\'s: do not shorten them.',
      type: 'object', group: 'testimonials',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'tag', title: 'Heading', type: 'string', initialValue: 'Client stories' }),
        defineField({
          name: 'items',
          title: 'Stories',
          description: 'Drag to reorder.',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              defineField({ name: 'label', title: 'Short name', type: 'string',
                description: 'What the list on the left calls this story: a word from the quote. Empty, it uses the client\'s name.' }),
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
      name: 'work',
      title: 'Case studies',
      description: 'The pile of cards you drag sideways, near the foot of the page. It needs at least seven projects to be thrown.',
      type: 'object', group: 'work',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'tag', title: 'Small note at the top', type: 'text', rows: 2, description: 'Two short lines. Press Enter between them.' }),
        defineField({ name: 'title', title: 'Heading', type: 'string', initialValue: 'Case studies.' }),
        defineField({ name: 'intro', title: 'Line under the heading', type: 'string' }),
        defineField({ name: 'featured', title: 'Projects in the pile',
          description: 'Drag to reorder. The first is the one in the middle when the page opens.',
          type: 'array', of: [{ type: 'reference', to: [{ type: 'project' }] }],
          validation: (r) => r.min(7).warning('The pile needs at least seven projects to be thrown.') }),
        defineField({ name: 'cta', title: 'Button under the pile', ...cta }),
      ],
    }),

    defineField({
      name: 'faqs',
      title: 'FAQs',
      description: 'The questions that open one at a time, with the founder\'s picture beside them.',
      type: 'object', group: 'faqs',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'tag', title: 'Small label', type: 'string', initialValue: 'FAQs' }),
        defineField({ name: 'title', title: 'Heading', type: 'string' }),
        defineField({ name: 'aside', title: 'Line beside the picture', type: 'text', rows: 2, description: 'Press Enter to break the line.' }),
        defineField({ name: 'cta', title: 'Button beside the picture', ...cta }),
        defineField({
          name: 'items',
          title: 'Questions',
          description: 'Drag to reorder.',
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

    defineField({
      name: 'seo', title: 'Search & sharing', type: 'seo', group: 'seo',
      description: 'Everything here fills itself in: the title is "IMMRSV | Designing the future of experience", the description and picture are the ones in Menu & footer. Change them only to say something different for the homepage.',
    }),
    // replaced by Search & sharing; kept so nothing written in it is lost
    defineField({ name: 'description', type: 'text', hidden: true }),

    // a section that is no longer on the page; kept so nothing written in it is lost
    defineField({
      name: 'process', type: 'object', hidden: true,
      fields: [
        defineField({ name: 'tag', type: 'string' }),
        defineField({ name: 'title', type: 'string' }),
        defineField({ name: 'intro', type: 'text' }),
        defineField({ name: 'steps', type: 'array', of: [{ type: 'object', fields: [
          defineField({ name: 'title', type: 'string' }), defineField({ name: 'body', type: 'text' }) ] }] }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
});
