import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { media } from 'sanity-plugin-media';
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list';
import { HomeIcon } from '@sanity/icons/Home';
import { CaseIcon } from '@sanity/icons/Case';
import { ThListIcon } from '@sanity/icons/ThList';
import { CogIcon } from '@sanity/icons/Cog';
import { DocumentTextIcon } from '@sanity/icons/DocumentText';
import { schemaTypes } from './sanity/schemas';

/** The Studio, hosted by Sanity at https://immrsv.sanity.studio — and reached
 *  from the site at /admin, which only points there (src/pages/admin.astro).
 *  Deployed with `npm run studio:deploy`. The project lives in Oscar's
 *  organization (manage.sanity.io); inviting someone is done there.
 *
 *  The sidebar is the site, in the order someone would look for things: the
 *  homepage, the work, then what every page shares, then the small print.
 *  The pages that exist once open straight into their one document. */
export default defineConfig({
  name: 'immrsv',
  title: 'IMMRSV',
  /* not secrets: the project and dataset are in every public request */
  projectId: '74hn5mqs',
  dataset: 'production',
  plugins: [
    structureTool({
      title: 'Content',
      structure: (S, context) =>
        S.list()
          .title('IMMRSV')
          .items([
            S.listItem().title('Homepage').icon(HomeIcon)
              .child(S.document().schemaType('home').documentId('home').title('Homepage')),
            // drag to reorder: this order is the Work page's
            orderableDocumentListDeskItem({ type: 'project', title: 'Projects', icon: CaseIcon, S, context }),
            S.listItem().title('Work page').icon(ThListIcon)
              .child(S.document().schemaType('workPage').documentId('workPage').title('Work page')),
            S.divider(),
            S.listItem().title('Menu & footer').icon(CogIcon)
              .child(S.document().schemaType('settings').documentId('settings').title('Menu & footer')),
            S.listItem().title('Legal pages').icon(DocumentTextIcon).child(
              S.list().title('Legal pages').items([
                S.listItem().title('Privacy policy').icon(DocumentTextIcon)
                  .child(S.document().schemaType('legalPage').documentId('privacy').title('Privacy policy')),
                S.listItem().title('Terms of use').icon(DocumentTextIcon)
                  .child(S.document().schemaType('legalPage').documentId('terms').title('Terms of use')),
              ]),
            ),
          ]),
    }),
    /* a Media tab: every picture and clip on the site in one place, tagged by
       where it is used (npm run cms:tag), to find, replace and see its uses */
    media(),
  ],
  /* the pages that exist once are not made again from the + menu */
  document: {
    newDocumentOptions: (prev) => prev.filter((t) => !['home', 'settings', 'workPage', 'legalPage'].includes(t.templateId)),
    actions: (prev, { schemaType }) =>
      ['home', 'settings', 'workPage', 'legalPage'].includes(schemaType)
        ? prev.filter((a) => !['duplicate', 'delete', 'unpublish'].includes(a.action ?? ''))
        : prev,
  },
  schema: { types: schemaTypes },
});
