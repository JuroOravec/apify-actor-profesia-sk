import type { Log } from 'apify';
import type { DOMLib } from 'apify-actor-utils';

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
  extractPartnerEntries: <T>({ domLib, log }: { domLib: DOMLib<T>; log: Log }) => {
    log.info('Starting extracting partners entries');
    const rootEl = domLib.root();

    log.info('Collecting partners categories');
    const tabNames = domLib.findMany(rootEl, '.nav-tabs a', (el) => domLib.text(el)).filter(Boolean) as string[]; // prettier-ignore
    const tabCards = domLib.findMany(rootEl, '.tab-content .card');
    log.info(`Found ${tabNames.length} partners categories ${JSON.stringify(tabNames)}`);

    const entries = tabCards
      .map((tabCardEl, tabIndex) => {
        const category = tabNames[tabIndex];
        log.info(`Extracting entries for category ${category}`);

        const categEntries = domLib.findMany(tabCardEl, '.row', (entryEl) => {
          return partnersDOMActions.extractSinglePartnerEntry({ domLib, entryEl, category }); // prettier-ignore
        });

        log.info(`Found ${categEntries.length} entries for category ${category}`);

        return categEntries;
      })
      .flat(1);

    log.info(`Done extracting partners entries (total ${entries.length})`);
    return entries;
  },

  extractSinglePartnerEntry: <T>({
    domLib,
    entryEl,
    category,
  }: {
    domLib: DOMLib<T>;
    entryEl: T;
    category: string;
  }): PartnerEntry => {
    const baseUrl = domLib.url();
    const logoUrl = domLib.findOne(entryEl, 'img', (el) => domLib.src(el, { baseUrl }));

    const infoEl = domLib.findOne(entryEl, 'div:nth-child(2)');
    const urlEl = domLib.findOne(infoEl, 'a');
    const url = domLib.href(urlEl, { baseUrl });
    const name = domLib.text(urlEl);
    // Remove el so description text is easy to take
    domLib.remove(urlEl);
    const description = domLib.text(infoEl);

    return { name, url, description, logoUrl, category };
  },
};
