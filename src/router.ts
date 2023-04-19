import { PlaywrightCrawlingContext, createPlaywrightRouter } from 'crawlee';
import * as cheerio from 'cheerio';

import {
  RouteHandler,
  createPlaywrightRouteMatchers,
  registerHandlers,
  setupDefaultRoute,
} from './lib/router';
import { playwrightHandlerWithApifyErrorCapture } from './lib/errorHandler';
import { GenericListEntry, nonJobListsPageActions } from './pageActions/jobRelatedLists';
import { PartnerEntry, partnersPageActions } from './pageActions/partners';
import type { SimpleProfesiaSKJobOfferItem, ProfesiaSkActorInput } from './types';
import { pushDataWithMetadata } from './utils/actor';
import { datasetTypeToUrl, routeLabels } from './constants';
import { jobListingPageActions } from './pageActions/jobListing';
import { jobDetailPageActions } from './pageActions/jobDetail';
import { serialAsyncMap, wait } from './utils/async';

// Originally based on https://docs.apify.com/academy/expert-scraping-with-apify/solutions/using-storage-creating-tasks

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

const defaultRoutes = createPlaywrightRouteMatchers<typeof routeLabels>([
  {
    // Check if user give us URL of the main page. If so, redirect them to job listing page https://www.profesia.sk/praca
    name: 'Main page',
    to: null,
    // Check for main page like https://www.profesia.sk/?#
    match: (url) => url.match(/[\W]profesia\.sk\/?(?:[?#~]|$)/i),
    action: async (url, ctx, _, handlers) => {
      await ctx.page.goto(datasetTypeToUrl.jobOffers);
      await handlers.JOB_LISTING(ctx);
    },
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
    // - https://www.profesia.sk/praca/zoznam-pozicii/
    // - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
    // - https://www.profesia.sk/praca/zoznam-spolocnosti/
    // - https://www.profesia.sk/praca/zoznam-lokalit/
    name: routeLabels.JOB_RELATED_LIST,
    to: routeLabels.JOB_RELATED_LIST,
    match: (url) => url.match(/[\W]profesia\.sk\/praca\/zoznam-[a-z0-9-]+\/?(?:[?#~]|$)/i),
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/accenture/C3691
    // - https://www.profesia.sk/praca/365-bank/C232838
    name: 'Company detail - custom',
    to: null,
    match: async (url, { page }) => {
      return isUrlOfCompanyProfile(url) && await page.locator('body.listing.custom-design').count(); // prettier-ignore
    },
    action: (url, { log }) => { log.error(`UNSUPPORTED PAGE TYPE DETECTED - company page with custom design. These are not supported. URL will not be processed. URL: ${url}`); }, // prettier-ignore
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/123kurier/C238652
    name: 'Company detail - standard',
    // Company page with standard design is just a job listing with extra infobox for the company.
    // Eg consider this https://www.profesia.sk/praca/123kurier/C238652
    to: routeLabels.JOB_LISTING,
    match: async (url, { page }) => {
      return isUrlOfCompanyProfile(url) && await page.locator('body.listing:not(.custom-design)').count(); // prettier-ignore
    },
  },

  {
    // Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
    // - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
    // - https://www.profesia.sk/praca/komix-sk/O4556386
    // - https://www.profesia.sk/praca/accenture/O4491399
    // - https://www.profesia.sk/praca/gohealth/O3964543
    name: routeLabels.JOB_DETAIL,
    to: routeLabels.JOB_DETAIL,
    match: (url) => isUrlOfJobOffer(url),
  },

  {
    // Check for pages like these. NOTE: This is a CATCH-ALL for /praca URLs
    // - https://www.profesia.sk/praca/bratislavsky-kraj/?count_days=21&remote_work=1&salary=500&salary_period=m&search_anywhere=tech
    // - https://www.profesia.sk/praca/account-executive/
    // - https://www.profesia.sk/praca/anglicky-jazyk/
    // - https://www.profesia.sk/praca/okres-pezinok/
    name: routeLabels.JOB_LISTING,
    to: routeLabels.JOB_LISTING,
    match: (url) => url.match(/[\W]profesia\.sk\/praca\//i),
  },

  {
    // Check for partners page like https://www.profesia.sk/partneri/?#
    name: routeLabels.PARTNERS,
    to: routeLabels.PARTNERS,
    match: (url) => url.match(/[\W]profesia\.sk\/partneri\/?(?:[?#~]|$)/i),
  },
]);

export const setupRouter = async (input: ProfesiaSkActorInput) => {
  const router = createPlaywrightRouter();

  const handlers = await createHandlers(input);
  await setupDefaultRoute(router, defaultRoutes, handlers);
  await registerHandlers(router, handlers);

  return { router };
};

const createHandlers = <Ctx extends PlaywrightCrawlingContext>(
  input: ProfesiaSkActorInput
): Record<keyof typeof routeLabels, RouteHandler<Ctx>> => {
  const handlers = {
    JOB_LISTING: playwrightHandlerWithApifyErrorCapture(async (ctx) => {
      const { page, log, crawler } = ctx;
      const { jobOfferDetailed } = input;

      const onData = async (entries: SimpleProfesiaSKJobOfferItem[]) => {
        // If not detailed, just save the data
        if (!jobOfferDetailed) {
          await pushDataWithMetadata(entries, ctx);
          return;
        }

        // If "detailed" option, also fetch and process the job detail page for each entry
        log.info(`Fetching details page of ${entries.length} entries`);

        const detailedEntries = await serialAsyncMap(entries, async (entry) => {
          if (!entry.offerUrl) {
            log.info(`Skipping fetching details page - URL is missing (ID: ${entry.offerId})`);
            return;
          }

          log.info(`Fetching details page (ID: ${entry.offerId}) URL: ${entry.offerUrl}`);
          const entryHtml = (await ctx.sendRequest({ url: entry.offerUrl, method: 'GET' })).body;
          log.info(`Done fetching details page (ID: ${entry.offerId}) URL: ${entry.offerUrl}`);

          const cheerioDom = cheerio.load(entryHtml);
          const jobDetail = jobDetailPageActions.extractJobDetail({ cheerioDom, log, url: entry.offerUrl, jobData: entry }); // prettier-ignore

          await wait(100);
          return jobDetail;
        });
        await pushDataWithMetadata(detailedEntries, ctx);
      };

      await jobListingPageActions.extractJobOffers({ page, log, crawler, input, onData });
    }),

    // - https://www.profesia.sk/praca/komix-sk/O4556386
    // - https://www.profesia.sk/praca/accenture/O4491399
    // - https://www.profesia.sk/praca/gohealth/O3964543
    // - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
    JOB_DETAIL: playwrightHandlerWithApifyErrorCapture(async (ctx) => {
      const { log, request } = ctx;

      const cheerioDom = await ctx.parseWithCheerio();
      const entry = jobDetailPageActions.extractJobDetail({ cheerioDom, log, url: request.loadedUrl, jobData: request.userData?.offer }); // prettier-ignore
      await pushDataWithMetadata(entry, ctx);
    }),

    JOB_RELATED_LIST: playwrightHandlerWithApifyErrorCapture(async (ctx) => {
      const { page, log } = ctx;

      const onData = async (data: GenericListEntry[]) => {
        await pushDataWithMetadata(data, ctx);
      };

      const isLocationsPage = page.url().match(/[\W]profesia\.sk\/praca\/zoznam-lokalit/i);
      const extractFn = isLocationsPage
        ? nonJobListsPageActions.extractLocationsLinks
        : nonJobListsPageActions.extractGenericLinks;
      await extractFn({ page, log, onData });
    }),

    PARTNERS: playwrightHandlerWithApifyErrorCapture(async (ctx) => {
      const { page } = ctx;

      const onData = async (data: PartnerEntry[]) => {
        await pushDataWithMetadata(data, ctx);
      };

      await partnersPageActions.extractEntries({ page, onData, log: ctx.log });
    }),
  };

  return handlers;
};
