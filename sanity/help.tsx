/* The guide that opens first in the Studio: how the site is edited, in the
   words of the person editing it. Plain text and nothing to configure, so it
   cannot drift out of step with a setting somewhere. */
import { Box, Card, Heading, Stack, Text } from '@sanity/ui';

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

export function Help() {
  return (
    <Box padding={5} style={{ maxWidth: 720 }}>
      <Stack space={5}>
        <Heading size={3}>How to edit the IMMRSV website</Heading>
        {sections.map(([title, lines]) => (
          <Card key={title} padding={4} radius={2} shadow={1}>
            <Stack space={4}>
              <Heading size={1}>{title}</Heading>
              {lines.map((l, i) => <Text key={i} size={2} muted={false}>{l}</Text>)}
            </Stack>
          </Card>
        ))}
        <Text size={1} muted>The address of this editor is immrsv.studio/admin (or immrsv.sanity.studio).</Text>
      </Stack>
    </Box>
  );
}
