import type { Log } from 'apify';
import type { Portadom } from 'portadom';

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
  extractPartnerEntries: async <T extends Portadom<any, any>>({ dom, log }: { dom: T; log: Log }) => {
    log.info('Starting extracting partners entries');
    const rootEl = dom.root();

    log.info('Collecting partners categories');
    const tabNames = await rootEl.findMany('.nav-tabs a')
      .mapAsyncSerial((el) => el.text())
      .then((arr) => arr.filter(Boolean) as string[]); // prettier-ignore
    log.info(`Found ${tabNames.length} partners categories ${JSON.stringify(tabNames)}`);

    const entries = await rootEl.findMany('.tab-content .card')
      .mapAsyncSerial(async (tabCardEl, tabIndex) => {
        const category = tabNames[tabIndex];
        log.info(`Extracting entries for category ${category}`);

        const categEntries = await tabCardEl.findMany('.row')
          .mapAsyncSerial((entry) => {
            return partnersDOMActions.extractSinglePartnerEntry({ entry, category });
          });

        log.info(`Found ${categEntries.length} entries for category ${category}`);

        return categEntries;
      }).then((arr) => arr.flat(1));

    log.info(`Done extracting partners entries (total ${entries.length})`);
    return entries;
  },

  extractSinglePartnerEntry: async <T extends Portadom<object, any>>({
    entry,
    category,
  }: {
    entry: T;
    category: string;
  }) => {
    const logoUrl = await entry.findOne('img').src();

    const infoEl = entry.findOne('div:nth-child(2)');
    const urlEl = infoEl.findOne('a');
    const url = await urlEl.href();
    const name = await urlEl.text();

    // Remove el so description text is easy to take
    await urlEl.remove();
    const description = await infoEl.text();

    return { name, url, description, logoUrl, category } satisfies PartnerEntry;
  },
};
