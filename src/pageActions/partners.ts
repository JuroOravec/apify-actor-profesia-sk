import type { Page } from 'playwright';
import type { Log } from 'apify';

import { serialAsyncMap } from '../utils/async';
import type { MaybePromise } from '../utils/types.js';
import { generalPageActions } from './general';

export interface PartnerEntry {
  name: string | null;
  url: string | null;
  description: string | null;
  logoUrl: string | null;
  category: string | null;
}

/**
 * Actions for pages like this:
 * - https://www.profesia.sk/partneri
 */
export const partnersPageActions = {
  /** Extract partners links from https://www.profesia.sk/partneri */
  extractEntries: async ({
    page,
    log,
    onData,
  }: {
    page: Page;
    log: Log;
    onData: (data: PartnerEntry[], tabIndex: number) => MaybePromise<void>;
  }) => {
    log.info('Starting extracting partners entries');

    log.info('Collecting partners categories');
    const tabNames = (await page.locator('.nav-tabs a').allTextContents()).map((t) => t.trim());
    const tabLocs = await page.locator('.tab-content .card').all();
    log.info(`Found ${tabNames.length} partners categories ${JSON.stringify(tabNames)}`);

    await serialAsyncMap(tabLocs, async (tabLoc, tabIndex) => {
      log.info(`Extracting entries for category ${tabNames[tabIndex]}`);

      await generalPageActions.clickAwayCookieConsent({ page, log });

      const entries = await tabLoc.locator('.row').evaluateAll((entryEls, category) => {
        return entryEls.map((entryEl): PartnerEntry => {
          const logoUrl = entryEl.querySelector('img')?.src ?? null;

          const infoEl = entryEl.querySelector('div:nth-child(2)');
          const urlEl = infoEl?.querySelector('a');
          const url = urlEl?.href ?? null;
          const name = urlEl?.textContent?.trim() ?? null;
          urlEl?.remove(); // Remove el so description textContent is easy to take

          let description = infoEl?.textContent?.trim() ?? null;
          description = description ? description : null;

          return { name, url, description, logoUrl, category };
        });
      }, tabNames[tabIndex]);

      log.info(`Calling callback with ${entries.length} extracted entries`);
      await onData(entries, tabIndex);
      log.info(`DONE Calling callback with ${entries.length} extracted entries`);
    });

    log.info('Done extracting partners entries');
  },
};
