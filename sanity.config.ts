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
            S.divider(),
            S.documentTypeListItem('project').title('Projects'),
          ]),
    }),
  ],
  schema: { types: schemaTypes },
});
