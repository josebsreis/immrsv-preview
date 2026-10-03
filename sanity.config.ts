import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './sanity/schemas';

/** The Studio, embedded at /admin. Transferring the project to the client
 *  later is done in manage.sanity.io (invite them as admin); nothing here changes. */
export default defineConfig({
  name: 'immrsv',
  title: 'IMMRSV',
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET || 'production',
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem().title('Homepage').child(S.document().schemaType('home').documentId('home')),
            S.listItem().title('Work page').child(S.document().schemaType('workPage').documentId('workPage')),
            S.listItem().title('Site settings').child(S.document().schemaType('settings').documentId('settings')),
            S.listItem().title('Legal').child(
              S.list().title('Legal').items([
                S.listItem().title('Privacy policy').child(S.document().schemaType('legalPage').documentId('privacy')),
                S.listItem().title('Terms of use').child(S.document().schemaType('legalPage').documentId('terms')),
              ]),
            ),
            S.divider(),
            S.documentTypeListItem('project').title('Projects'),
          ]),
    }),
  ],
  /* the pages that exist once are not made again from the + menu */
  document: {
    newDocumentOptions: (prev) => prev.filter((t) => !['home', 'settings', 'workPage', 'legalPage'].includes(t.templateId)),
  },
  schema: { types: schemaTypes },
});
