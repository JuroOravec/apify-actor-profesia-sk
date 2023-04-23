import { CheerioCrawlingContext } from 'crawlee';
import * as cheerio from 'cheerio';
import * as Sentry from '@sentry/node';
import {
  cheerioCaptureErrorRouteHandler,
  createCheerioRouteMatchers,
  cheerioDOMLib,
  RouteHandler,
  pushDataWithMetadata,
} from 'apify-actor-utils';

import { GenericListEntry, jobRelatedListsPageActions } from './pageActions/jobRelatedLists';
import { partnersDOMActions } from './pageActions/partners';
import {
  SimpleProfesiaSKJobOfferItem,
  ProfesiaSkActorInput,
  RouteLabel,
  ROUTE_LABEL_ENUM,
} from './types';
import { datasetTypeToUrl } from './constants';
import { jobListingPageActions } from './pageActions/jobListing';
import { jobDetailDOMActions } from './pageActions/jobDetail';
import { serialAsyncMap, wait } from './utils/async';

// Capture errors as a separate Apify/Actor dataset and pass errors to Sentry
const reportingDatasetId = 'REPORTING';
export const errorCaptureHandlerWrapper: typeof cheerioCaptureErrorRouteHandler = (handler) => {
  return cheerioCaptureErrorRouteHandler(handler, {
    reportingDatasetId,
    allowScreenshot: true,
    onErrorCapture: ({ error, report }) => {
      Sentry.captureException(error, { extra: report as any });
    },
  });
};

const isUrlOfCompanyProfile = (url: string) =>
  url.match(/[\W]profesia\.sk\/praca\//i) &&
  // Either the url string has /C123456 in its path - eg https://www.profesia.sk/praca/accenture/C3691
  (url.match(/\/praca\/.*?\/C[0-9]{2,}/) ||
    // Or company_id=123456 in its query - eg https://www.profesia.sk/praca/?company_id=187125&utm_content=easy_logo&utm_medium=web&utm_source=profesia
    url.match(/company_id=[0-9]{2,}/));

const isUrlOfJobOffer = (url: string) =>
  url.match(/[\W]profesia\.sk\/praca\//i) &&
  // Url has /O123456 in its path (first is letter, not zero) - eg https://www.profesia.sk/praca/gohealth/O3964543
  url.match(/\/praca\/.*?\/O[0-9]{2,}/);

export const routes = createCheerioRouteMatchers<CheerioCrawlingContext, RouteLabel>([
  {
    // Check if user give us URL of the main page. If so, redirect them to job listing page https://www.profesia.sk/praca
    name: 'Main page',
    handlerLabel: null,
    // Check for main page like https://www.profesia.sk/?#
    match: (url) => url.match(/[\W]profesia\.sk\/?(?:[?#~]|$)/i),
    action: async (url, ctx, _, handlers) => {
      ctx.log.info(`Redirecting to ${datasetTypeToUrl.jobOffers}`);
      await ctx.crawler.addRequests([datasetTypeToUrl.jobOffers], { forefront: true });
    },
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
    // - https://www.profesia.sk/praca/zoznam-pozicii/
    // - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
    // - https://www.profesia.sk/praca/zoznam-spolocnosti/
    // - https://www.profesia.sk/praca/zoznam-lokalit/
    name: ROUTE_LABEL_ENUM.JOB_RELATED_LIST,
    handlerLabel: ROUTE_LABEL_ENUM.JOB_RELATED_LIST,
    match: (url) => url.match(/[\W]profesia\.sk\/praca\/zoznam-[a-z0-9-]+\/?(?:[?#~]|$)/i),
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/accenture/C3691
    // - https://www.profesia.sk/praca/365-bank/C232838
    name: 'Company detail - custom',
    handlerLabel: null,
    match: async (url, ctx) => {
      const domLib = cheerioDOMLib(ctx.$, url);
      const rootEl = domLib.root();
      const isCustomDesign = domLib.findMany(rootEl, 'body.listing.custom-design').length;
      return isUrlOfCompanyProfile(url) && isCustomDesign;
    },
    action: (url, { log }) => { log.error(`UNSUPPORTED PAGE TYPE DETECTED - company page with custom design. These are not supported. URL will not be processed. URL: ${url}`); }, // prettier-ignore
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/123kurier/C238652
    name: 'Company detail - standard',
    // Company page with standard design is just a job listing with extra infobox for the company.
    // Eg consider this https://www.profesia.sk/praca/123kurier/C238652
    handlerLabel: ROUTE_LABEL_ENUM.JOB_LISTING,
    match: async (url, ctx) => {
      const domLib = cheerioDOMLib(ctx.$, url);
      const rootEl = domLib.root();
      const isNotCustomDesign = domLib.findMany(rootEl, 'body.listing:not(.custom-design)').length;
      return isUrlOfCompanyProfile(url) && isNotCustomDesign;
    },
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
    // - https://www.profesia.sk/praca/komix-sk/O4556386
    // - https://www.profesia.sk/praca/accenture/O4491399
    // - https://www.profesia.sk/praca/gohealth/O3964543
    name: ROUTE_LABEL_ENUM.JOB_DETAIL,
    handlerLabel: ROUTE_LABEL_ENUM.JOB_DETAIL,
    match: (url) => isUrlOfJobOffer(url),
  },

  {
    // Check for pages like these. NOTE: This is a CATCH-ALL for /praca URLs
    // - https://www.profesia.sk/praca/bratislavsky-kraj/?count_days=21&remote_work=1&salary=500&salary_period=m&search_anywhere=tech
    // - https://www.profesia.sk/praca/account-executive/
    // - https://www.profesia.sk/praca/anglicky-jazyk/
    // - https://www.profesia.sk/praca/okres-pezinok/
    name: ROUTE_LABEL_ENUM.JOB_LISTING,
    handlerLabel: ROUTE_LABEL_ENUM.JOB_LISTING,
    match: (url) => url.match(/[\W]profesia\.sk\/praca\//i),
  },

  {
    // Check for partners page like https://www.profesia.sk/partneri/?#
    name: ROUTE_LABEL_ENUM.PARTNERS,
    handlerLabel: ROUTE_LABEL_ENUM.PARTNERS,
    match: (url) => url.match(/[\W]profesia\.sk\/partneri\/?(?:[?#~]|$)/i),
  },
]);

export const createHandlers = <Ctx extends CheerioCrawlingContext>(input: ProfesiaSkActorInput) =>
  ({
    JOB_LISTING: async (ctx) => {
      const { request, log } = ctx;
      const { jobOfferDetailed } = input;

      const onData = async (entries: SimpleProfesiaSKJobOfferItem[]) => {
        // If not detailed, just save the data
        if (!jobOfferDetailed) {
          await pushDataWithMetadata(entries, ctx);
          return;
        }

        // If "detailed" option, also fetch and process the job detail page for each entry
        log.info(`Fetching details page of ${entries.length} entries`);

        await serialAsyncMap(entries, async (entry) => {
          if (!entry.offerUrl) {
            log.info(`Skipping fetching details page - URL is missing (ID: ${entry.offerId})`);
            return;
          }

          log.info(`Fetching details page (ID: ${entry.offerId}) URL: ${entry.offerUrl}`);
          const entryHtml = (await ctx.sendRequest({ url: entry.offerUrl, method: 'GET' })).body;
          log.info(`Done fetching details page (ID: ${entry.offerId}) URL: ${entry.offerUrl}`);

          const cheerioDom = cheerio.load(entryHtml);
          const domLib = cheerioDOMLib(cheerioDom, entry.offerUrl);
          const jobDetail = jobDetailDOMActions.extractJobDetail({ domLib, log, jobData: entry }); // prettier-ignore

          // Push the data after each scraped page to limit the chance of losing data
          await Promise.all([pushDataWithMetadata(jobDetail, ctx), wait(100)]);

          return jobDetail;
        });
      };

      const domLib = cheerioDOMLib(ctx.$, request.loadedUrl || request.url);
      const listingPageNum = request.userData?.listingPageNum || 1;
      await jobListingPageActions.extractJobOffers({
        domLib,
        log,
        input,
        listingPageNum,
        onFetchHTML: (opts) => ctx.sendRequest(opts).then((d) => d.body),
        onData,
        onScheduleNextPage: async (url) => {
          await ctx.crawler.addRequests([
            { url, label: ROUTE_LABEL_ENUM.JOB_LISTING, userData: { listingPageNum: listingPageNum + 1 } }, // prettier-ignore
          ]);
        },
      });
    },

    // - https://www.profesia.sk/praca/komix-sk/O4556386
    // - https://www.profesia.sk/praca/accenture/O4491399
    // - https://www.profesia.sk/praca/gohealth/O3964543
    // - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
    JOB_DETAIL: async (ctx) => {
      const { log, request } = ctx;

      const domLib = cheerioDOMLib(ctx.$, request.loadedUrl || request.url);
      const entry = jobDetailDOMActions.extractJobDetail({ domLib, log, jobData: request.userData?.offer }); // prettier-ignore
      await pushDataWithMetadata(entry, ctx);
    },

    JOB_RELATED_LIST: async (ctx) => {
      const { request, log } = ctx;

      const onData = async (data: GenericListEntry[]) => {
        await pushDataWithMetadata(data, ctx);
      };

      const url = request.loadedUrl || request.url;
      const domLib = cheerioDOMLib(ctx.$, url);
      const isLocationsPage = url.match(/[\W]profesia\.sk\/praca\/zoznam-lokalit/i); // prettier-ignore
      const extractFn = isLocationsPage
        ? jobRelatedListsPageActions.extractLocationsLinks
        : jobRelatedListsPageActions.extractGenericLinks;
      await extractFn({
        domLib,
        log,
        onFetchHTML: (opts) => ctx.sendRequest(opts).then((d) => d.body),
        onData,
      });
    },

    PARTNERS: async (ctx) => {
      const domLib = cheerioDOMLib(ctx.$, ctx.request.loadedUrl || ctx.request.url);

      const entries = partnersDOMActions.extractPartnerEntries({ domLib, log: ctx.log });

      await pushDataWithMetadata(entries, ctx);
    },
  } satisfies Record<RouteLabel, RouteHandler<Ctx>>);
