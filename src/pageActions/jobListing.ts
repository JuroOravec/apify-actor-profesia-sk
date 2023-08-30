import type { Log } from 'crawlee';
import type { OptionsInit } from 'got-scraping';
import { load as loadCheerio } from 'cheerio';
import { CrawleeOneIO, getDatasetCount } from 'crawlee-one';
import { Portadom, cheerioPortadom } from 'portadom';

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

interface ExtractJobOffersOptions<T extends Portadom<any, any>> {
  dom: T;
  io: CrawleeOneIO;
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
  extractJobOffers: async <T extends Portadom<any, any>>({ dom: origDom, log, io, listingPageNum = null, onScheduleNextPage, input, onFetchHTML, onData }: ExtractJobOffersOptions<T>) => {
    const { jobOfferCountOnly, outputDatasetId, outputMaxEntries } = input;
    const origUrl = await origDom.url();

    // Navigate to URL that has filters applied
    log.info(`Generating URL that has filters applied. OLD URL: ${origUrl}`);
    const newUrl = jobListingMethods.createUrlWithFilters({ url: origUrl, log, input });
    if (!newUrl || !origUrl) throw Error (`Something went wrong, one or both URLs are missing: ${JSON.stringify({ newUrl, origUrl })}`);

    const hasUrlChanged = !equalUrls(origUrl, newUrl);
    
    let dom = origDom;
    if (hasUrlChanged) {
      log.info(`Redirecting to URL that has filters applied. NEW URL: ${newUrl}`);
      dom = await onFetchHTML({ url: newUrl }).then((html) => cheerioPortadom(loadCheerio(html).root(), newUrl) as T);
    } else {
      log.info(`Generated URL with filters is the same as current URL`);
    }

    const pageCountInfo = await jobListingDOMActions.parsePageCount({ dom, log }); // prettier-ignore
    if (pageCountInfo) {
      log.info(`Total ${pageCountInfo.total} entries exist for current filter settings. URL: ${newUrl}`);
    }

    // Leave after printing the count
    if (jobOfferCountOnly) {
      log.info('Actor is in debugging mode. Entries are not scraped. Leaving now.');
      return;
    }

    const unadjustedEntries = await jobListingDOMActions.extractJobOfferEntries({ dom, log });
    if (!unadjustedEntries.length) {
      log.info('Stopping scraping - no entries found. We assume this is the end of pagination');
      return;
    }
    
    // If limit reached, shorten the array as needed
    const { limitReached, overflow } = await jobListingMethods.checkDatasetEntriesCount({
      currBatchCount: unadjustedEntries.length,
      maxCount: outputMaxEntries,
      datasetNameOrId: outputDatasetId,
      customItemCount: (listingPageNum ?? 1) * 20,
    }, { log, io });
    const entries = !limitReached ? unadjustedEntries : unadjustedEntries.slice(0, -1 * overflow);

    // Schedule the next page.
    // NOTE: We do this BEFORE the onData callback, so the new page can be scraped in parallel
    // while this page might still be scraping details of entries.
    if (!limitReached && entries.length) {
      const nextPageUrl = jobListingMethods.getNextPageUrl({ url: newUrl, log });
      log.info('Scheduling next pagination page for scraping');
      await onScheduleNextPage(nextPageUrl);
      log.info('Done scheduling next pagination page for scraping');
    } else {
      if (limitReached) log.info('Stopping pagination - already have max entries');
    }

    log.info(`Calling callback with ${entries.length} extracted entries`);
    await onData(entries);
    log.info(`DONE calling callback with ${entries.length} extracted entries`);
  },
};

export const jobListingDOMActions = {
  // prettier-ignore
  extractJobOfferEntries: async <T extends Portadom<any, any>>({ dom, log }: { dom: T; log: Log }) => {
    log.info(`Extracting entries from the page`);
    const rootEl = await dom.root();
    const url = await dom.url();

    // Find and extract data
    const entries = await rootEl.findMany('.list-row:not(.native-agent):not(.reach-list)')
      .mapAsyncSerial(async (el) => {
      const employerName = await el.findOne('.employer').text();
      const employerUrl = await el.findOne('.offer-company-logo-link').href(); // prettier-ignore
      const employerLogoUrl = await el.findOne('.offer-company-logo-link img').src(); // prettier-ignore

      const offerUrlEl = el.findOne('h2 a');
      const offerUrl = await offerUrlEl.href();
      const offerName = await offerUrlEl.text();
      const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

      const location = await el.findOne('.job-location').text();

      const salaryText = await el.findOne('.label-group > a[data-dimension7="Salary label"]').text(); // prettier-ignore
      const salaryFields = jobDetailMethods.parseSalaryText(salaryText);

      const labels = await el.findMany('.label-group > a:not([data-dimension7="Salary label"])')
        .mapAsyncSerial((el) => el.text())
        .then((arr) => arr.filter(Boolean) as string[]);

      const footerInfoEl = el.findOne('.list-footer .info');
      const lastChangeRelativeTimeEl = footerInfoEl.findOne('strong');
      const lastChangeRelativeTime = await lastChangeRelativeTimeEl.text();
      // Remove the element so it's easier to get the text content
      await lastChangeRelativeTimeEl.remove();
      const lastChangeTypeText = await footerInfoEl.textAsLower();
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

  parsePageCount: async <T extends Portadom<any, any>>({ dom, log }: { dom: T; log: Log }) => {
    log.info('Parsing results count');
    const rootEl = dom.root();

    const toNum = (t: string) => strAsNumber(t, { removeWhitespace: true, mode: 'int' }) ?? 0;

    const countText = await rootEl.findOne('.offer-counter').text();
    if (!countText) return null;

    const [rawCurrRange, rawTotal] = countText.split('z').map((t) => t.trim()) ?? [];
    const total = toNum(rawTotal);
    const [lowerPageEnd, upperPageEnd] = rawCurrRange?.split('-').map((t) => toNum(t));

    log.info(`Done parsing results count: ${JSON.stringify({ total, upperPageEnd, lowerPageEnd })}`); // prettier-ignore
    return { total, upperPageEnd, lowerPageEnd } satisfies PageCountInfo;
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

  /**
   * Given a batch of entries, use several strategies to check
   * if we've reached the limit on the max number of entries
   * we're allowed to extract this run.
   */
  checkDatasetEntriesCount: async (
    {
      currBatchCount,
      maxCount,
      datasetNameOrId,
      customItemCount,
    }: {
      /** Number of entries in the current batch */
      currBatchCount: number;
      /** Max number of entries allowed to extract. */
      maxCount?: number | null;
      /**
       * If given, maxCount will be ALSO compared against
       * the amount of entries already in the dataset.
       */
      datasetNameOrId?: string | null;
      /**
       * If given, maxCount will be ALSO compared against
       * this amount.
       */
      customItemCount?: number | null;
    },
    { io, log }: { io: CrawleeOneIO; log: Log }
  ) => {
    const datasetItemCount = datasetNameOrId
      ? await getDatasetCount(datasetNameOrId, { log, io })
      : null;

    if ((datasetItemCount == null && customItemCount == null) || maxCount == null) {
      return { limitReached: false, overflow: 0 };
    }

    // Check if we've reached the limit for max entries
    if (currBatchCount >= maxCount) {
      return { limitReached: true, overflow: currBatchCount - maxCount };
    }

    // Use count of items already in dataset to check if limit reached
    if (datasetItemCount != null && datasetItemCount + currBatchCount >= maxCount) {
      return { limitReached: true, overflow: datasetItemCount + currBatchCount - maxCount };
    }

    // Use page offset to check if limit reached (20 entries per page)
    if (customItemCount != null && customItemCount >= maxCount) {
      return { limitReached: true, overflow: customItemCount - maxCount };
    }

    return { limitReached: false, overflow: 0 };
  },
};
