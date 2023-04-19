import type { Page } from 'playwright';
import type { Log } from 'apify';

import { serialAsyncMap } from '../utils/async';
import { resolveUrlPath } from '../utils/url';
import type { MaybePromise } from '../utils/types.js';
import { generalPageActions } from './general';

export interface GenericListEntry {
  url: string;
  name: string;
  count: number;
}

export interface LocationListEntry extends GenericListEntry {
  region: string | null;
  country: string;
}

interface RawExtractedLink {
  url: string;
  name: string;
  count: number;
  lastHeadingTitle: string;
}

/**
 * Actions for pages like these:
 * - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
 * - https://www.profesia.sk/praca/zoznam-pozicii/
 * - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
 * - https://www.profesia.sk/praca/zoznam-spolocnosti/
 * - https://www.profesia.sk/praca/zoznam-lokalit/
 */
export const nonJobListsPageActions = {
  /**
   * Extract following kind of links from:
   * - companies - https://www.profesia.sk/praca/zoznam-spolocnosti/
   * - industries - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
   * - positions - https://www.profesia.sk/praca/zoznam-pozicii/
   * - language requirements - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
   */
  extractGenericLinks: async ({
    page,
    log,
    onData,
  }: {
    page: Page;
    log: Log;
    onData: (data: GenericListEntry[], tabIndex: number) => MaybePromise<void>;
  }) => {
    log.info('Starting extracting entries');
    await nonJobListsPageActions.extractEntries({
      page,
      log,
      onData: async (entries, tabIndex) => {
        const processedEntries: GenericListEntry[] = entries.map(({ url, name, count }) => ({
          url,
          name,
          count,
        }));
        await onData(processedEntries, tabIndex);
      },
    });
    log.info('Done extracting entries');
  },

  /** Extract location links from https://www.profesia.sk/praca/zoznam-lokalit/ */
  extractLocationsLinks: async ({
    page,
    onData,
    log,
  }: {
    page: Page;
    log: Log;
    onData: (data: LocationListEntry[], tabIndex: number) => MaybePromise<void>;
  }) => {
    log.info('Starting extracting partners entries');
    await nonJobListsPageActions.extractEntries({
      page,
      log,
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
        await onData(processedEntries, tabIndex);
      },
    });
    log.info('Done extracting location entries');
  },

  extractEntries: async ({
    page,
    onData,
    log,
  }: {
    page: Page;
    log: Log;
    onData: (data: RawExtractedLink[], tabIndex: number) => MaybePromise<void>;
  }) => {
    log.info('Collecting tabs information');
    // Some pages have navigation to split up the links, some don't
    const pageNavLoc = page.locator('.nav-tabs a');
    const pageHasNav = await pageNavLoc.count();
    // If there's no navigation on the page, we still want to trigger the next section of code once
    const maybePagesNavLocs = pageHasNav ? await pageNavLoc.all() : [null];
    log.info(`Found ${maybePagesNavLocs[0] ? maybePagesNavLocs.length : 0} tabs`);

    await serialAsyncMap(maybePagesNavLocs, async (pageNavLoc, tabIndex) => {
      if (pageHasNav && pageNavLoc) log.info(`Extracting entries for tab ${await pageNavLoc?.textContent()}`); // prettier-ignore

      await generalPageActions.clickAwayCookieConsent({ page, log });

      if (pageNavLoc) {
        log.info(`Clicking on tab`);
        await pageNavLoc.click();
        log.info(`Done clicking on tab`);
      }

      const entries = await nonJobListsPageActions.extractEntriesOnTab({ page, log });

      log.info(`Calling callback with ${entries.length} extracted entries`);
      await onData(entries, tabIndex);
      log.info(`DONE Calling callback with ${entries.length} extracted entries`);
    });
  },

  extractEntriesOnTab: async ({ page, log }: { page: Page; log: Log }) => {
    log.info('Starting extracting tab content entries');
    const entries = await page.locator('h1').evaluate((titleEl) => {
      const linksContainer = titleEl.parentElement;

      const linkEls = [
        ...((linksContainer?.querySelectorAll('.card a') || []) as HTMLAnchorElement[]),
      ]
        // Ignore anchor links, like the alphabet links here
        // https://www.profesia.sk/praca/zoznam-spolocnosti/
        .filter((linkEl) => !linkEl.href.startsWith('#'));

      let lastHeadingTitle: string;
      return linkEls.map((linkEl): RawExtractedLink => {
        const url = linkEl.href.startsWith('/')
          ? resolveUrlPath(page.url(), linkEl.href)
          : linkEl.href;
        const isHeading = linkEl.querySelector('h2');

        let count: number;
        let name: string;

        if (isHeading) {
          // Get count
          const countEl = linkEl.querySelector('span');
          count = Number.parseInt(countEl?.textContent || '0');
          // Remove the span, so we can then easily get the name
          countEl?.remove();
          name = lastHeadingTitle = linkEl.textContent || '';
        } else {
          name = linkEl.textContent || '';
          const countEl = linkEl.parentElement?.querySelector('span');
          count = Number.parseInt(countEl?.textContent || '0');
        }

        return { url, name, count, lastHeadingTitle };
      });
    });

    log.info(`Found ${entries.length} entries.`);
    return entries;
  },
};
