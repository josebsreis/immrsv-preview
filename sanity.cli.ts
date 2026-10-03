import { defineCliConfig } from 'sanity/cli';

/** For the `sanity` command line (CORS, datasets, the import script). The
 *  Studio itself is embedded at /admin and reads sanity.config.ts. */
export default defineCliConfig({
  api: { projectId: '74hn5mqs', dataset: 'production' },
});
