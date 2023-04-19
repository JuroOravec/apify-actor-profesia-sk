import type { Log } from 'apify';
import { AnyNode, Cheerio, CheerioAPI } from 'cheerio';
import { resolveUrlPath } from '../utils/url';

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
  extractPartnerEntries: ({
    url,
    cheerioDom,
    log,
  }: {
    url: string;
    cheerioDom: CheerioAPI;
    log: Log;
  }) => {
    log.info('Starting extracting partners entries');

    log.info('Collecting partners categories');
    const tabNames = cheerioDom('.nav-tabs a').toArray().map((el) => cheerioDom(el).text()?.trim()).filter(Boolean); // prettier-ignore
    const tabCards = cheerioDom('.tab-content .card').toArray().map((el) => cheerioDom(el)); // prettier-ignore
    log.info(`Found ${tabNames.length} partners categories ${JSON.stringify(tabNames)}`);

    const entries = tabCards
      .map((tabCardEl, tabIndex) => {
        const category = tabNames[tabIndex];
        log.info(`Extracting entries for category ${category}`);

        const categEntries = tabCardEl.find('.row').toArray().map((el) => cheerioDom(el))
        .map((entryEl) => partnersPageActions.extractSinglePartnerEntry({ url, entryEl, category })); // prettier-ignore

        log.info(`Found ${categEntries.length} entries for category ${category}`);

        return categEntries;
      })
      .flat(1);

    log.info(`Done extracting partners entries (total ${entries.length})`);
    return entries;
  },

  extractSinglePartnerEntry: ({
    url: domainUrl,
    entryEl,
    category,
  }: {
    url: string;
    entryEl: Cheerio<AnyNode>;
    category: string;
  }): PartnerEntry => {
    let logoUrl = entryEl.find('img')?.first().prop('src')?.trim() ?? null;
    if (logoUrl && logoUrl.startsWith('/')) logoUrl = resolveUrlPath(domainUrl, logoUrl);

    const infoEl = entryEl.find('div:nth-child(2)').first();
    const urlEl = infoEl?.find('a').first();
    const url = urlEl?.prop('href') ?? null;
    const name = urlEl?.text()?.trim() ?? null;
    urlEl?.remove(); // Remove el so description textContent is easy to take

    const description: string | null = infoEl?.text()?.trim() || null;

    return { name, url, description, logoUrl, category };
  },
};
