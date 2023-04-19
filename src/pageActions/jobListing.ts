import type { Page } from 'playwright';
import type { Log, PlaywrightCrawler } from 'crawlee';

import type {
  EmploymentType,
  SimpleProfesiaSKJobOfferItem,
  SalaryPeriod,
  WorkFromHomeType,
  ProfesiaSkActorInput,
} from '../types';
import { routeLabels } from '../constants';
import type { MaybePromise } from '../utils/types';
import { generalPageActions } from './general';

interface PageCountInfo {
  total: number;
  upperPageEnd: number;
  lowerPageEnd: number;
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

// TODO - could be optimized to use Cheerio instead of Playwright / Puppeteer
export const jobListingPageActions = {
  extractJobOffers: async ({
    page,
    log,
    crawler,
    input,
    onData,
  }: {
    page: Page;
    log: Log;
    crawler: PlaywrightCrawler;
    input: ProfesiaSkActorInput;
    onData: (data: SimpleProfesiaSKJobOfferItem[]) => MaybePromise<void>;
  }) => {
    const { jobOfferCountOnly } = input;

    // Navigate to URL that has filters applied
    log.info(`Generating URL that has filters applied. OLD URL: ${page.url()}`);
    const newUrl = jobListingPageActions.createUrlWithFilters({ page, log, input });
    log.info(`Redirecting to URL that has filters applied. NEW URL: ${newUrl}`);
    await page.goto(newUrl);

    const pageCountInfo = await jobListingPageActions.parsePageCount({ page, log }); // prettier-ignore
    log.info(`Total ${pageCountInfo.total} entries found for URL ${newUrl}`);

    // Leave after printing the count
    if (jobOfferCountOnly) return;

    await generalPageActions.clickAwayCookieConsent({ page, log });

    const unadjustedEntries = await jobListingPageActions.extractJobOfferEntries({ page, log });
    const { entries, isLimitReached } = jobListingPageActions.shortenEntriesToMaxLen({ entries: unadjustedEntries, input, pageCountInfo }); // prettier-ignore

    log.info(`Calling callback with ${entries.length} extracted entries`);
    await onData(entries);
    log.info(`DONE Calling callback with ${entries.length} extracted entries`);

    // Navigate to the next page
    if (!isLimitReached) {
      const nextPageUrl = await jobListingPageActions.getNextPageUrl({ page, log });
      if (nextPageUrl) {
        await crawler.addRequests([{ url: nextPageUrl, label: routeLabels.JOB_LISTING }]);
      }
    }
  },

  extractJobOfferEntries: async ({ page, log }: { page: Page; log: Log }) => {
    // Find and extract data
    log.info(`Extracting entries from the page`);
    const entries = await page.locator('.list-row:not(.native-agent)').evaluateAll((els) => {
      return els.map((el) => {
        const employerName = el.querySelector('.employer')?.textContent?.trim() ?? null;
        const employerUrl = el.querySelector<HTMLAnchorElement>('.offer-company-logo-link')?.href ?? null; // prettier-ignore
        const employerLogoUrl = el.querySelector<HTMLImageElement>('.offer-company-logo-link img')?.src ?? null; // prettier-ignore

        const offerUrlEl = el.querySelector<HTMLAnchorElement>('h2 a');
        const offerUrl = offerUrlEl?.href ?? null;
        const offerName = offerUrlEl?.textContent?.trim() ?? null;
        const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

        const location = el.querySelector('.job-location')?.textContent?.trim() ?? null;

        const salaryLabelEl = el.querySelector('.label-group > a[data-dimension7="Salary label"]'); // prettier-ignore
        const otherLabelEls = [...el.querySelectorAll('.label-group > a:not([data-dimension7="Salary label"])')]; // prettier-ignore

        const labels = otherLabelEls
          .map((el) => el.textContent?.trim())
          .filter(Boolean) as string[];

        const salaryText = salaryLabelEl?.textContent?.trim() ?? null;
        // Try to parse texts like "Od 6,5 EUR/hod."
        let parsedSalary = salaryText?.match(/^[a-z]*\s*(?<lowVal>[\d, ]+)\s*(?<curr>[\w\p{L}\p{M}\p{Zs}]+)\/(?<period>\w+)/iu); // prettier-ignore
        // Try to parse texts like "35 000 - 45 000 Kč/mesiac"
        if (!parsedSalary) parsedSalary = salaryText?.match(/^(?<lowVal>[\d,. ]+)\s*-\s*(?<upVal>[\d,. ]+)(?<curr>[\w\p{L}\p{M}\p{Zs}]+)\/(?<period>\w+)/iu); // prettier-ignore

        const { groups } = parsedSalary || { groups: { lowVal: '', upVal: '', curr: '', period: '' } }; // prettier-ignore
        const {
          lowVal: salaryRangeLower,
          upVal: salaryRangeUpper,
          curr: salaryCurrency,
          period: salaryPeriod,
        } = groups || {};

        const footerInfoEl = el.querySelector('.list-footer .info');
        const lastChangeRelativeTimeEl = footerInfoEl?.querySelector('strong');
        const lastChangeRelativeTime = lastChangeRelativeTimeEl?.textContent?.trim() ?? null;
        // Remove the element so it's easier to get the text content
        lastChangeRelativeTimeEl?.remove();
        const lastChangeTypeText = footerInfoEl?.textContent?.trim().toLocaleLowerCase();
        const lastChangeType = lastChangeTypeText === 'pridané' ? 'added' : 'modified';

        return {
          listingUrl: window.location.href,

          employerName,
          employerUrl,
          employerLogoUrl,

          offerName,
          offerUrl,
          offerId,

          salaryRange: salaryText,
          salaryRangeLower: salaryRangeLower != null ? Number.parseInt(salaryRangeLower.replace(/\s/g, '')) : null, // prettier-ignore
          salaryRangeUpper: salaryRangeUpper != null ? Number.parseInt(salaryRangeUpper.replace(/\s/g, '')) : null, // prettier-ignore
          salaryCurrency,
          salaryPeriod,

          location,
          labels,
          lastChangeRelativeTime,
          lastChangeType,
        } satisfies SimpleProfesiaSKJobOfferItem;
      });
    });
    log.info(`Found ${entries.length} entries.`);
    return entries;
  },

  getNextPageUrl: async ({ page, log }: { page: Page; log: Log }) => {
    log.info('Parsing next page URL');

    // Navigate to the next page
    const nextPageLoc = page.locator('.pagination .next');
    const hasNextPage = await nextPageLoc.count();
    if (!hasNextPage) {
      log.info('No next page found');
      return null;
    }

    const nextPageUrl = await nextPageLoc.evaluate<string, HTMLAnchorElement>((el) => el.href);
    log.info(`Next page found. URL: ${nextPageUrl}`);
    return nextPageUrl;
  },

  createUrlWithFilters: ({
    page,
    log,
    input,
  }: {
    page: Page;
    log: Log;
    input: ProfesiaSkActorInput;
  }) => {
    const {
      jobOfferFilterEmploymentType,
      jobOfferFilterLastNDays,
      jobOfferFilterMinSalaryPeriod,
      jobOfferFilterMinSalaryValue,
      jobOfferFilterQuery,
      jobOfferFilterRemoteWorkType,
    } = input;

    const url = page.url();
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

  parsePageCount: async ({ page, log }: { page: Page; log: Log }) => {
    log.info('Parsing results count');

    const parsedCount = await page.locator('.offer-counter').evaluate((el): PageCountInfo => {
      const toNum = (t: string) => Number.parseInt(t.replace(/\s/g, '') || '0');
      const [rawCurrRange, rawTotal] = el.textContent?.split('z').map((t) => t.trim()) ?? [];
      const total = toNum(rawTotal);
      const [lowerPageEnd, upperPageEnd] = rawCurrRange.split('-').map((t) => toNum(t));
      return { total, upperPageEnd, lowerPageEnd };
    });

    log.info(`Done parsing results count: ${JSON.stringify(parsedCount)}`);
    return parsedCount;
  },

  shortenEntriesToMaxLen: ({
    input,
    entries,
    pageCountInfo,
  }: {
    input: ProfesiaSkActorInput;
    entries: SimpleProfesiaSKJobOfferItem[];
    pageCountInfo: PageCountInfo;
  }) => {
    const { jobOfferFilterMaxCount } = input;
    // Check if we've reached the limit for max entries
    const isLimitReached =
      jobOfferFilterMaxCount != null &&
      pageCountInfo.lowerPageEnd <= jobOfferFilterMaxCount &&
      jobOfferFilterMaxCount <= pageCountInfo.upperPageEnd;

    // If limit reached, shorten the array as needed
    const adjustedEntries = !isLimitReached
      ? entries
      : entries.slice(0, jobOfferFilterMaxCount - entries.length);
    return { isLimitReached, entries: adjustedEntries };
  },
};
