import type { Log } from 'apify';
import { load as loadCheerio } from 'cheerio';
import type { OptionsInit } from 'got-scraping';
import { DOMLib, cheerioDOMLib } from 'crawlee-one';

import { serialAsyncFilter, serialAsyncMap } from '../utils/async';
import type { MaybePromise } from '../utils/types.js';

export interface GenericListEntry {
  url: string | null;
  name: string | null;
  count: number;
}

export interface LocationListEntry extends GenericListEntry {
  region: string | null;
  country: string | null;
}

interface RawExtractedLink {
  url: string | null;
  name: string | null;
  count: number;
  lastHeadingTitle: string | null;
}

interface ExtractEntriesOptions<TData, TEl extends DOMLib<object, any>> {
  domLib: TEl;
  log: Log;
  onFetchHTML: (overrideOptions?: Partial<OptionsInit>) => Promise<string>;
  onData: (data: TData[], tabIndex: number) => MaybePromise<void>;
}

/**
 * Actions for pages like these:
 * - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
 * - https://www.profesia.sk/praca/zoznam-pozicii/
 * - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
 * - https://www.profesia.sk/praca/zoznam-spolocnosti/
 * - https://www.profesia.sk/praca/zoznam-lokalit/
 */
export const jobRelatedListsPageActions = {
  /**
   * Extract following kind of links from:
   * - companies - https://www.profesia.sk/praca/zoznam-spolocnosti/
   * - industries - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
   * - professions - https://www.profesia.sk/praca/zoznam-pozicii/
   * - language requirements - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
   */
  extractGenericLinks: async <T extends DOMLib<object, any>>(
    options: ExtractEntriesOptions<GenericListEntry, T>
  ) => {
    options.log.info('Starting extracting entries');
    await jobRelatedListsPageActions.extractEntries({
      ...options,
      onData: async (entries, tabIndex) => {
        const processedEntries: GenericListEntry[] = entries.map(({ url, name, count }) => ({
          url,
          name,
          count,
        }));
        await options.onData(processedEntries, tabIndex);
      },
    });
    options.log.info('Done extracting entries');
  },

  /** Extract location links from https://www.profesia.sk/praca/zoznam-lokalit/ */
  extractLocationsLinks: async <T extends DOMLib<object, any>>(
    options: ExtractEntriesOptions<LocationListEntry, T>
  ) => {
    options.log.info('Starting extracting partners entries');
    await jobRelatedListsPageActions.extractEntries({
      ...options,
      onData: async (entries, tabIndex) => {
        // Processing specific to https://www.profesia.sk/praca/zoznam-lokalit/
        const isSlovakEntries = tabIndex === 0;
        const processedEntries: LocationListEntry[] = entries.map(
          ({ url, name, count, lastHeadingTitle }) => ({
            url,
            name,
            count,
            region: isSlovakEntries ? lastHeadingTitle : null,
            country: isSlovakEntries ? 'Slovenská republika' : lastHeadingTitle,
          })
        );
        await options.onData(processedEntries, tabIndex);
      },
    });
    options.log.info('Done extracting location entries');
  },

  extractEntries: async <T extends DOMLib<object, any>>({
    domLib,
    onData,
    onFetchHTML,
    log,
  }: ExtractEntriesOptions<RawExtractedLink, T>) => {
    const pageNavTexts = await jobRelatedListsDOMActions.extractNavTabs({ domLib, log }); // prettier-ignore
    // If there's no navigation on the page, we still want to run the next section of code once
    const maybePagesNavTabs = pageNavTexts.length ? pageNavTexts : [null];

    const baseUrl = await domLib.url();
    if (!baseUrl) throw Error('Cannot fetch entries for individual tabs - URL is missing');

    await serialAsyncMap(maybePagesNavTabs, async (tabText, tabIndex) => {
      // To fetch a particular page, use ?tab_index=0
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('tab_index', tabIndex.toString());

      log.info(`Fetching entries for tab ${tabText}`);
      const tabPageHTML = await onFetchHTML({ url: urlObj });
      log.info(`Extracting entries for tab ${tabText}`);

      const tabDomLib = cheerioDOMLib(loadCheerio(tabPageHTML).root(), baseUrl);
      const entries = await jobRelatedListsDOMActions.extractEntriesOnTab({ domLib: tabDomLib, log }); // prettier-ignore

      log.info(`Calling callback with ${entries.length} entries extracted from tab ${tabText}`);
      await onData(entries, tabIndex);
      log.info(`DONE Calling callback with ${entries.length} entries extracted from tab ${tabText}`); // prettier-ignore
    });
  },
};

export const jobRelatedListsDOMActions = {
  extractNavTabs: async <T extends DOMLib<object, any>>({
    domLib,
    log,
  }: {
    domLib: T;
    log: Log;
  }) => {
    log.info('Collecting tabs information');
    const rootEl = await domLib.root();

    // Some pages have navigation to split up the links, some don't
    const pageNavTabEls = (await rootEl?.findMany('.nav-tabs a')) ?? [];
    const pageNavTexts = (await serialAsyncMap(pageNavTabEls, (el) => el.text())).filter(
      Boolean
    ) as string[];
    log.info(`Found ${pageNavTexts.length} tabs`);
    return pageNavTexts;
  },

  extractEntriesOnTab: async <T extends DOMLib<any, any>>({
    domLib,
    log,
  }: {
    domLib: T;
    log: Log;
  }) => {
    log.info('Starting extracting tab content entries');
    const rootEl = await domLib.root();
    const baseUrl = await domLib.url();

    const linksContainer = await (await rootEl?.findOne('h1'))?.parent();
    const linkCardEls = (await linksContainer?.findMany('.card a')) ?? [];
    const linkEls = await serialAsyncFilter(linkCardEls, async (linkEl) => {
      // Ignore anchor links, like the alphabet links here
      // https://www.profesia.sk/praca/zoznam-spolocnosti/
      const href = await linkEl.href({ baseUrl });
      return href ? !href?.startsWith('#') : null;
    });

    let lastHeadingTitle: string | null;
    const entries = await serialAsyncMap(linkEls, async (linkEl) => {
      const url = await linkEl.href({ baseUrl });
      const isHeading = await linkEl.findOne('h2');

      let count: number;
      let name: string | null;

      if (isHeading) {
        // Get count
        const countEl = await linkEl.findOne('span');
        count = (await countEl?.textAsNumber({ mode: 'int', removeWhitespace: true })) ?? 0;
        // Remove the span, so we can then easily get the name
        await countEl?.remove();
        name = lastHeadingTitle = await linkEl.text();
      } else {
        name = await linkEl.text();
        const countEl = await (await linkEl.parent())?.findOne('span');
        count = (await countEl?.textAsNumber({ mode: 'int', removeWhitespace: true })) ?? 0;
      }

      return { url, name, count, lastHeadingTitle } satisfies RawExtractedLink;
    });

    log.info(`Found ${entries.length} entries.`);
    return entries;
  },
};
