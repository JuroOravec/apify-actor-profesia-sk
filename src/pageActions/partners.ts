import type { Log } from 'apify';
import type { DOMLib } from 'crawlee-one';

import { serialAsyncMap } from '../utils/async';

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
export const partnersDOMActions = {
  /** Extract partners links from https://www.profesia.sk/partneri */
  // prettier-ignore
  extractPartnerEntries: async <T extends DOMLib<object, object>>({ domLib, log }: { domLib: T; log: Log }) => {
    log.info('Starting extracting partners entries');
    const rootEl = await domLib.root();
    const url = await domLib.url();

    log.info('Collecting partners categories');
    const tabs = (await rootEl?.findMany('.nav-tabs a')) ?? [];
    const tabNames = (await serialAsyncMap(tabs, async (el) => {
      const text = await el.text();
      return text;
    })).filter(Boolean) as string[]; // prettier-ignore
    log.info(`Found ${tabNames.length} partners categories ${JSON.stringify(tabNames)}`);

    const tabCards = (await rootEl?.findMany('.tab-content .card')) ?? [];
    const entries = (await serialAsyncMap(tabCards, async (tabCardEl, tabIndex) => {
        const category = tabNames[tabIndex];
        log.info(`Extracting entries for category ${category}`);

        const rowEls = await tabCardEl.findMany('.row');
        const categEntries = await serialAsyncMap(rowEls, (entry) => {
          return partnersDOMActions.extractSinglePartnerEntry({ url, entry, category }); // prettier-ignore
        });

        log.info(`Found ${categEntries.length} entries for category ${category}`);

        return categEntries;
      }))
      .flat(1);

    log.info(`Done extracting partners entries (total ${entries.length})`);
    return entries;
  },

  extractSinglePartnerEntry: async <T extends DOMLib<object, any>>({
    entry,
    url: baseUrl,
    category,
  }: {
    entry: T;
    url: string | null;
    category: string;
  }) => {
    const logoEl = await entry.findOne('img');
    const logoUrl = (await logoEl?.src({ baseUrl })) ?? null;

    const infoEl = await entry.findOne('div:nth-child(2)');
    const urlEl = await infoEl?.findOne('a');
    const url = (await urlEl?.href({ baseUrl })) ?? null;
    const name = (await urlEl?.text()) ?? null;

    // Remove el so description text is easy to take
    await urlEl?.remove();
    const description = (await infoEl?.text()) ?? null;

    return { name, url, description, logoUrl, category } satisfies PartnerEntry;
  },
};
