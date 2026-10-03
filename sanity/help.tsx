/* The guide that opens first in the Studio: how the site is edited, in the
   words of the person editing it. Plain text and nothing to configure, so it
   cannot drift out of step with a setting somewhere.

   Laid out by hand rather than with the Studio's stacks: those set the
   lines tight and the sections loose in a way that read as one block. Here
   it is a reading column — a comfortable measure, an easy line height, air
   between the points and more between the sections — and the pane scrolls. */
import type { CSSProperties } from 'react';

const sections: [string, string[]][] = [
  ['Publishing', [
    'Change anything, then press Publish (bottom right). Until then it is a draft and the website does not change.',
    'The website updates a minute or two after you publish. Refresh it to see the change.',
    'Changed your mind before publishing? The ⋯ menu next to Publish has "Discard changes".',
  ]],
  ['The homepage', [
    'Homepage has a tab for each section, numbered in the order they come down the page. Each tab says where its section is.',
    'Fixed parts that cannot be edited here: the moving particles at the top, the film where the figure is built, the icons on its cards, and the layout and movement of every section.',
  ]],
  ['Adding a project', [
    'Projects → the + button. Fill in Basics (title, press Generate for the web address, tick its studio, the line under the title), then Text, then Pictures & video. The cover is required.',
    'Publish. It appears on the Work page, in its studio’s pictures on the homepage, and gets its own page.',
    'To put it in the Case studies pile on the homepage: Homepage → 7 · Case studies → add it to "Projects in the pile". Keep at least seven there.',
  ]],
  ['Changing the order', [
    'Projects: drag them up and down in the Projects list; that is the order of the Work page.',
    'Every list inside a page (cards, questions, stories, figures, menu buttons) is reordered by dragging the handle on the left of each item.',
  ]],
  ['Pictures and video', [
    'Pictures: JPG or WebP, around 2200 pixels wide. The site makes the smaller sizes itself. Add a few words of Alt text describing the picture.',
    'Videos: MP4, silent, under about 10 MB. Add a Still frame from the video itself.',
    'The Media tab (top of the screen) shows every picture and video on the site, tagged by where it is used.',
  ]],
  ['Menu, footer and contact', [
    'Menu & footer holds the buttons at the top of every page, the email and phone, the footer’s buttons, its rotating word and the social links.',
  ]],
  ['Search and sharing', [
    'Every page fills in its own title, description and sharing picture. The Search & sharing tab on each page is only for when the automatic one is not right; empty fields use the automatic version.',
  ]],
];

const css: Record<string, CSSProperties> = {
  pane: { height: '100%', overflowY: 'auto', boxSizing: 'border-box', padding: '40px 32px 64px',
          color: 'var(--card-fg-color)', fontFamily: 'var(--font-family-base, system-ui, sans-serif)' },
  column: { maxWidth: 640, margin: '0 auto' },
  title: { margin: '0 0 8px', fontSize: 26, lineHeight: 1.25, fontWeight: 600 },
  intro: { margin: '0 0 40px', fontSize: 15, lineHeight: 1.6, opacity: 0.7 },
  section: { margin: '0 0 36px', paddingTop: 24, borderTop: '1px solid var(--card-border-color, rgba(128,128,128,.25))' },
  heading: { margin: '0 0 14px', fontSize: 17, lineHeight: 1.3, fontWeight: 600 },
  list: { margin: 0, paddingLeft: 20, display: 'grid', gap: 12 },
  item: { fontSize: 15, lineHeight: 1.65 },
  foot: { marginTop: 48, fontSize: 13, lineHeight: 1.6, opacity: 0.6 },
};

export function Help() {
  return (
    <div style={css.pane}>
      <div style={css.column}>
        <h1 style={css.title}>How to edit the IMMRSV website</h1>
        <p style={css.intro}>Everything on the site that can be changed is in the list on the left. This page is the short version of how.</p>
        {sections.map(([title, lines]) => (
          <section key={title} style={css.section}>
            <h2 style={css.heading}>{title}</h2>
            <ul style={css.list}>
              {lines.map((l, i) => <li key={i} style={css.item}>{l}</li>)}
            </ul>
          </section>
        ))}
        <p style={css.foot}>This editor opens at immrsv.studio/admin, or immrsv.sanity.studio.</p>
      </div>
    </div>
  );
}
