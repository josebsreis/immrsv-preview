import { defineCliConfig } from 'sanity/cli';

/** For the `sanity` command line: deploying the Studio (to
 *  immrsv.sanity.studio), CORS, datasets, the import and tagging scripts. */
export default defineCliConfig({
  api: { projectId: '74hn5mqs', dataset: 'production' },
  studioHost: 'immrsv',
  /* the hosted Studio takes Sanity's fixes as they ship, so it never sits on
     an old version (that is what the rich-text warning was) */
  deployment: { appId: 'sxmw044ic1nrctmi36i189et', autoUpdates: true },
  /* the Studio shares this folder with the website: without this its build
     copied the site's public/ — every picture and frame — into the Studio */
  vite: (config) => ({ ...config, publicDir: false }),
});
