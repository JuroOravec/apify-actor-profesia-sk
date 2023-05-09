import { Actor } from 'apify';
import type { Log } from 'crawlee';
import type { OptionsInit } from 'got-scraping';
import { load as loadCheerio } from 'cheerio';
import { DOMLib, cheerioDOMLib } from 'apify-actor-utils';

import type {
  EmploymentType,
  SimpleProfesiaSKJobOfferItem,
  SalaryPeriod,
  WorkFromHomeType,
} from '../types';
import type { MaybePromise } from '../utils/types';
import { jobDetailMethods } from './jobDetail';
import { equalUrls } from '../utils/url';
import { strAsNumber } from '../utils/format';
import type { ActorInput } from '../config';

interface PageCountInfo {
  total: number;
  upperPageEnd: number;
  lowerPageEnd: number;
}

interface ExtractJobOffersOptions<TEl> {
  domLib: DOMLib<TEl>;
  log: Log;
  input: ActorInput;
  listingPageNum?: number | null;
  onFetchHTML: (overrideOptions?: Partial<OptionsInit>) => Promise<string>;
  onData: (data: SimpleProfesiaSKJobOfferItem[]) => MaybePromise<void>;
  onScheduleNextPage: (url: string) => MaybePromise<void>;
}

const workFromHomeCodes: Record<WorkFromHomeType, string> = {
  fullRemote: '1',
  partialRemote: '2',
  noRemote: '0',
};

const salaryPeriodCodes: Record<SalaryPeriod, string> = {
  month: 'm',
  hour: 'h',
};

const employmentTypeInfo: Record<EmploymentType, { urlPath: string; text: string }> = {
  fte: { urlPath: 'plny-uvazok', text: 'plný úväzok' },
  pte: { urlPath: 'skrateny-uvazok', text: 'skrátený úväzok' },
  selfemploy: { urlPath: 'zivnost', text: 'živnosť' },
  voluntary: { urlPath: 'na-dohodu-brigady', text: 'na dohodu (brigády)' },
  internship: { urlPath: 'internship-staz', text: 'internship, stáž' },
};

export const jobListingPageActions = {
  // prettier-ignore
  extractJobOffers: async <T>({ domLib: origDomLib, log, listingPageNum = null, onScheduleNextPage, input, onFetchHTML, onData }: ExtractJobOffersOptions<T>) => {
    const { jobOfferCountOnly } = input;
    const origUrl = origDomLib.url();

    // Navigate to URL that has filters applied
    log.info(`Generating URL that has filters applied. OLD URL: ${origUrl}`);
    const newUrl = jobListingMethods.createUrlWithFilters({ url: origUrl, log, input });
    if (!newUrl || !origUrl) throw Error (`Something went wrong, one or both URLs are missing: ${JSON.stringify({ newUrl, origUrl })}`);

    const hasUrlChanged = !equalUrls(origUrl, newUrl);
    
    let domLib = origDomLib;
    if (hasUrlChanged) {
      log.info(`Redirecting to URL that has filters applied. NEW URL: ${newUrl}`);
      domLib = await onFetchHTML({ url: newUrl }).then((html) => cheerioDOMLib(loadCheerio(html), newUrl) as DOMLib<any>);
    } else {
      log.info(`Generated URL with filters is the same as current URL`);
    }

    const pageCountInfo = jobListingDOMActions.parsePageCount({ domLib, log }); // prettier-ignore
    if (pageCountInfo) {
      log.info(`Total ${pageCountInfo.total} entries exist for current filter settings. URL: ${newUrl}`);
    }

    // Leave after printing the count
    if (jobOfferCountOnly) {
      log.info('Actor is in debugging mode. Entries are not scraped. Leaving now.');
      return;
    }

    const unadjustedEntries = jobListingDOMActions.extractJobOfferEntries({ domLib, log });
    if (!unadjustedEntries.length) {
      log.info('Stopping scraping - no entries found. We assume this is the end of pagination');
      return;
    }

    log.debug('Obtaining dataset entries count');
    const itemCountBefore = (await (await Actor.openDataset()).getInfo())?.itemCount ?? null;
    log.debug(`Done obtaining dataset entries count (${itemCountBefore})`);
    if (typeof itemCountBefore !== 'number') {
      log.warning('Failed to get count of entries in dataset (AKA already collected entries). We currently use this info to know how many items were scraped. This scraper might scrape more entries than was set.'); // prettier-ignore
    }

    const { entries, isLimitReached } = jobListingMethods.shortenEntriesToMaxLen({ entries: unadjustedEntries, input, itemsCount: itemCountBefore, listingPageNum }); // prettier-ignore

    // Schedule the next page.
    // NOTE: We do this BEFORE the onData callback, so the new page can be scraped in parallel
    // while this page might still be scraping details of entries.
    if (!isLimitReached && entries.length) {
      const nextPageUrl = jobListingMethods.getNextPageUrl({ url: newUrl, log });
      log.info('Scheduling next pagination page for scraping');
      await onScheduleNextPage(nextPageUrl);
      log.info('Done scheduling next pagination page for scraping');
    } else {
      if (isLimitReached) log.info('Stopping pagination - already have max entries');
    }

    log.info(`Calling callback with ${entries.length} extracted entries`);
    await onData(entries);
    log.info(`DONE calling callback with ${entries.length} extracted entries`);
  },
};

export const jobListingDOMActions = {
  // prettier-ignore
  extractJobOfferEntries: <T>({ domLib, log }: { domLib: DOMLib<T>; log: Log }) => {
    log.info(`Extracting entries from the page`);
    const rootEl = domLib.root();
    const url = domLib.url();
    
    // Find and extract data
    const entries = domLib.findMany(rootEl, '.list-row:not(.native-agent):not(.reach-list)', (el) => {
      const employerName = domLib.findOne(el, '.employer', (el) => domLib.text(el));
      const employerUrl = domLib.findOne(el, '.offer-company-logo-link', (el) => domLib.href(el, { baseUrl: url })); // prettier-ignore
      const employerLogoUrl = domLib.findOne(el, '.offer-company-logo-link img', (el) => domLib.src(el, { baseUrl: url })); // prettier-ignore

      const offerUrlEl = domLib.findOne(el, 'h2 a');
      const offerUrl = domLib.href(offerUrlEl, { baseUrl: url });
      const offerName = domLib.text(offerUrlEl);
      const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

      const location = domLib.findOne(el, '.job-location', (el) => domLib.text(el));

      const salaryText = domLib.findOne(el, '.label-group > a[data-dimension7="Salary label"]', (el) => domLib.text(el)); // prettier-ignore
      const salaryFields = jobDetailMethods.parseSalaryText(salaryText);

      // prettier-ignore
      const labels = domLib
        .findMany(el, '.label-group > a:not([data-dimension7="Salary label"])', (el) => domLib.text(el))
        .filter(Boolean) as string[];

      const footerInfoEl = domLib.findOne(el, '.list-footer .info');
      const lastChangeRelativeTimeEl = domLib.findOne(footerInfoEl, 'strong');
      const lastChangeRelativeTime = domLib.text(lastChangeRelativeTimeEl);
      // Remove the element so it's easier to get the text content
      domLib.remove(lastChangeRelativeTimeEl);
      const lastChangeTypeText = domLib.textAsLower(footerInfoEl);
      const lastChangeType = lastChangeTypeText === 'pridané' ? 'added' : 'modified';

      return {
        listingUrl: url,

        employerName,
        employerUrl,
        employerLogoUrl,

        offerName,
        offerUrl,
        offerId,

        location,
        labels,
        lastChangeRelativeTime,
        lastChangeType,

        ...salaryFields,
      } satisfies SimpleProfesiaSKJobOfferItem;
    });

    log.info(`Found ${entries.length} entries.`);
    return entries;
  },

  parsePageCount: <T>({ domLib, log }: { domLib: DOMLib<T>; log: Log }): PageCountInfo | null => {
    log.info('Parsing results count');
    const rootEl = domLib.root();

    const toNum = (t: string) => strAsNumber(t, { removeWhitespace: true, mode: 'int' }) ?? 0;

    const countText = domLib.findOne(rootEl, '.offer-counter', (el) => domLib.text(el));
    if (!countText) return null;

    const [rawCurrRange, rawTotal] = countText?.split('z').map((t) => t.trim()) ?? [];
    const total = toNum(rawTotal);
    const [lowerPageEnd, upperPageEnd] = rawCurrRange?.split('-').map((t) => toNum(t));

    log.info(`Done parsing results count: ${JSON.stringify({ total, upperPageEnd, lowerPageEnd })}`); // prettier-ignore
    return { total, upperPageEnd, lowerPageEnd };
  },
};

export const jobListingMethods = {
  createUrlWithFilters: ({
    url,
    log,
    input,
  }: {
    url: string | null;
    log: Log;
    input: ActorInput;
  }) => {
    const {
      jobOfferFilterEmploymentType,
      jobOfferFilterLastNDays,
      jobOfferFilterMinSalaryPeriod,
      jobOfferFilterMinSalaryValue,
      jobOfferFilterQuery,
      jobOfferFilterRemoteWorkType,
    } = input;

    if (!url) return null;

    const urlObj = new URL(url);

    // Setup query filter - https://www.profesia.sk/praca/administrativny-pracovnik-referent/?search_anywhere=tech
    if (jobOfferFilterQuery != null) {
      urlObj.searchParams.set('search_anywhere', jobOfferFilterQuery);
    }

    // Setup last N days filter - https://www.profesia.sk/praca/administrativny-pracovnik-referent/?count_days=21
    if (jobOfferFilterLastNDays != null) {
      urlObj.searchParams.set('count_days', jobOfferFilterLastNDays.toString());
    }

    // Setup work from home filter - https://www.profesia.sk/praca/administrativny-pracovnik-referent/?remote_work=1
    if (jobOfferFilterRemoteWorkType) {
      urlObj.searchParams.set('remote_work', workFromHomeCodes[jobOfferFilterRemoteWorkType]);
    }

    // Setup salary filter - https://www.profesia.sk/praca/administrativny-pracovnik-referent/?salary=3&salary_period=h
    if (jobOfferFilterMinSalaryValue != null) {
      urlObj.searchParams.set('salary', jobOfferFilterMinSalaryValue.toString());

      let salaryPeriod: SalaryPeriod | undefined = jobOfferFilterMinSalaryPeriod;
      if (!jobOfferFilterMinSalaryPeriod) {
        salaryPeriod = jobOfferFilterMinSalaryValue >= 100 ? 'month' : 'hour';
        log.warning(`Salary period is missing. Using value "${salaryPeriod}" as fallback.`);
      }
      urlObj.searchParams.set('salary_period', salaryPeriodCodes[salaryPeriod!]);
    }

    // Setup employment filter - https://www.profesia.sk/praca/internship-staz/
    if (jobOfferFilterEmploymentType) {
      const urlPath = employmentTypeInfo[jobOfferFilterEmploymentType].urlPath;
      if (!urlObj.pathname.includes(urlPath)) {
        urlObj.pathname.replace(/^\/praca\//i, `/praca/${urlPath}`);
      }
    }

    return urlObj.href;
  },

  shortenEntriesToMaxLen: ({
    input,
    entries,
    itemsCount,
    listingPageNum,
  }: {
    input: ActorInput;
    entries: SimpleProfesiaSKJobOfferItem[];
    itemsCount: number | null;
    listingPageNum: number | null;
  }) => {
    const { jobOfferFilterMaxCount } = input;

    if ((itemsCount == null && listingPageNum == null) || jobOfferFilterMaxCount == null) {
      return { entries, isLimitReached: false };
    }

    // Check if we've reached the limit for max entries
    let isLimitReached = false;
    // Use count of items already in dataset to check if limit reached
    if (!isLimitReached && itemsCount != null && itemsCount + entries.length >= jobOfferFilterMaxCount) isLimitReached = true; // prettier-ignore
    // Use page offset to check if limit reached (20 entries per page)
    if (!isLimitReached && listingPageNum != null && listingPageNum * 20 >= jobOfferFilterMaxCount) isLimitReached = true; // prettier-ignore

    // If limit reached, shorten the array as needed
    const adjustedEntries = !isLimitReached
      ? entries
      : entries.slice(0, jobOfferFilterMaxCount - entries.length);
    return { isLimitReached, entries: adjustedEntries };
  },

  getNextPageUrl: ({ url, log }: { url: string; log: Log }) => {
    log.info(`Creating next page URL from URL: ${url}`);
    const urlObj = new URL(url);
    const currPageNum = Number.parseInt(urlObj.searchParams.get('page_num') ?? '1');
    const nextPageNum = currPageNum + 1;
    urlObj.searchParams.set('page_num', nextPageNum.toString());
    const nextPageUrl = urlObj.href;
    log.info(`Done creating next page URL: ${nextPageUrl}`);
    return nextPageUrl;
  },
};
