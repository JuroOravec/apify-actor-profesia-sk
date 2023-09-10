import * as cheerio from 'cheerio';
import type { PushDataOptions } from 'crawlee-one';
import { cheerioPortadom } from 'portadom';

import { GenericListEntry, jobRelatedListsPageActions } from './pageActions/jobRelatedLists';
import { partnersDOMActions } from './pageActions/partners';
import { jobListingPageActions } from './pageActions/jobListing';
import { jobDetailDOMActions } from './pageActions/jobDetail';
import { wait } from './utils/async';
import { profesiaLabelEnum, profesiaRoute } from './__generated__/crawler';
import type { SimpleProfesiaSKJobOfferItem } from './types';
import { datasetTypeToUrl } from './constants';
import type { ActorInput } from './config';

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

const pushDataOptions = {
  includeMetadata: true,
} satisfies Omit<PushDataOptions<any>, 'privacyMask'>;

// Check if user give us URL of the main page. If so, redirect them to
// job listing page - https://www.profesia.sk/praca
export const mainPageRoute: profesiaRoute<ActorInput> = {
  // Check for main page like https://www.profesia.sk/?#
  match: /[\W]profesia\.sk\/?(?:[?#~]|$)/i,
  handler: async (ctx) => {
    const url = datasetTypeToUrl.jobOffers;
    ctx.log.info(`Redirecting to ${url}`);
    await ctx.pushRequests([{ url }], { queueOptions: { forefront: true } });
  },
};

export const jobListingRoute: profesiaRoute<ActorInput> = {
  match: [
    // Company page with standard design is just a job listing with extra infobox for the company.
    // - https://www.profesia.sk/praca/123kurier/C238652
    // NOTE: We want this to match BEFORE the JOB_LISTING route
    async (url, ctx) => {
      const dom = cheerioPortadom(ctx.$.root(), url);
      const isNotCustomDesign = await dom.findMany('body.listing:not(.custom-design)').length;
      return isUrlOfCompanyProfile(url) && !!isNotCustomDesign;
    },
    // Check for pages like these. NOTE: This is a CATCH-ALL for /praca URLs
    // - https://www.profesia.sk/praca/bratislavsky-kraj/?count_days=21&remote_work=1&salary=500&salary_period=m&search_anywhere=tech
    // - https://www.profesia.sk/praca/account-executive/
    // - https://www.profesia.sk/praca/anglicky-jazyk/
    // - https://www.profesia.sk/praca/okres-pezinok/
    /[\W]profesia\.sk\/praca\//i,
  ],
  handler: async (ctx) => {
    const { request, log, actor, $, pushData, pushRequests, sendRequest } = ctx;
    const input = actor.input ?? {};

    const onData = async (entries: SimpleProfesiaSKJobOfferItem[]) => {
      // If not detailed, just save the data
      if (!input.jobOfferDetailed) {
        await pushData(entries, { ...pushDataOptions, privacyMask: {} });
        return;
      }

      // If "detailed" option, also fetch and process the job detail page for each entry
      log.info(`Fetching details page of ${entries.length} entries`);

      for (const entry of entries) {
        if (!entry.offerUrl) {
          log.info(`Skipping fetching details page - URL is missing (ID: ${entry.offerId})`);
          continue;
        }

        log.info(`Fetching details page (ID: ${entry.offerId}) URL: ${entry.offerUrl}`);
        const entryHtml = (await sendRequest({ url: entry.offerUrl, method: 'GET' })).body;
        log.info(`Done fetching details page (ID: ${entry.offerId}) URL: ${entry.offerUrl}`);

        const cheerioDom = cheerio.load(entryHtml);
        const dom = cheerioPortadom(cheerioDom.root(), entry.offerUrl);
        const jobDetail = await jobDetailDOMActions.extractJobDetail({ dom, log, entry });

        // Push the data after each scraped page to limit the chance of losing data
        await Promise.all([
          pushData(jobDetail, {
            ...pushDataOptions,
            privacyMask: {
              employerContact: true,
              phoneNumbers: true,
            },
          }),
          wait(100),
        ]);
      }
    };

    const dom = cheerioPortadom($.root(), request.loadedUrl || request.url);
    const listingPageNum = request.userData?.listingPageNum || 1;
    await jobListingPageActions.extractJobOffers({
      dom,
      io: actor.io,
      log,
      input: actor.input ?? {},
      listingPageNum,
      onFetchHTML: (opts) => sendRequest(opts).then((d) => d.body),
      onData,
      onScheduleNextPage: async (url) => {
        await pushRequests([
          {
            url,
            label: profesiaLabelEnum.jobListing,
            userData: { listingPageNum: listingPageNum + 1 },
          },
        ]);
      },
    });
  },
};

// Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
// - https://www.profesia.sk/praca/komix-sk/O4556386
// - https://www.profesia.sk/praca/accenture/O4491399
// - https://www.profesia.sk/praca/gohealth/O3964543
// - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
export const jobDetailRoute: profesiaRoute<ActorInput> = {
  match: (url) => isUrlOfJobOffer(url),
  handler: async (ctx) => {
    const { log, request, $, pushData } = ctx;

    const dom = cheerioPortadom($.root(), request.loadedUrl || request.url);
    const entry = await jobDetailDOMActions.extractJobDetail({ dom, log, entry: request.userData?.offer }); // prettier-ignore
    await pushData(entry, {
      ...pushDataOptions,
      privacyMask: {
        employerContact: true,
        phoneNumbers: true,
      },
    });
  },
};

// Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
// - https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/
// - https://www.profesia.sk/praca/zoznam-pozicii/
// - https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/
// - https://www.profesia.sk/praca/zoznam-spolocnosti/
// - https://www.profesia.sk/praca/zoznam-lokalit/
export const jobRelatedListRoute: profesiaRoute = {
  match: /[\W]profesia\.sk\/praca\/zoznam-[a-z0-9-]+\/?(?:[?#~]|$)/i,
  handler: async (ctx) => {
    const { request, log, $, pushData, sendRequest } = ctx;

    const onData = async (data: GenericListEntry[]) => {
      await pushData(data, { ...pushDataOptions, privacyMask: {} });
    };

    const url = request.loadedUrl || request.url;
    const dom = cheerioPortadom($.root(), url);
    const isLocationsPage = url.match(/[\W]profesia\.sk\/praca\/zoznam-lokalit/i); // prettier-ignore
    const extractFn = isLocationsPage
      ? jobRelatedListsPageActions.extractLocationsLinks
      : jobRelatedListsPageActions.extractGenericLinks;
    await extractFn({
      dom,
      log,
      onFetchHTML: (opts) => sendRequest(opts).then((d) => d.body),
      onData,
    });
  },
};

// Check for pages like these. NOTE: We want this to match BEFORE the JOB_LISTING route
// - https://www.profesia.sk/praca/accenture/C3691
// - https://www.profesia.sk/praca/365-bank/C232838
export const companyDetailCustomRoute: profesiaRoute = {
  match: async (url, ctx) => {
    const dom = cheerioPortadom(ctx.$.root(), url);
    const isCustomDesign = await dom.findMany('body.listing.custom-design').length;
    return isUrlOfCompanyProfile(url) && !!isCustomDesign;
  },
  handler: (ctx) => {
    const url = ctx.request.loadedUrl || ctx.request.url;
    ctx.log.error(
      `UNSUPPORTED PAGE TYPE DETECTED - company page with custom design. These are not supported. URL will not be processed. URL: ${url}`
    );
  },
};

// Check for partners page like https://www.profesia.sk/partneri/?#
export const partnersRoute: profesiaRoute = {
  match: /[\W]profesia\.sk\/partneri\/?(?:[?#~]|$)/i,
  handler: async (ctx) => {
    const { $, log, request, pushData } = ctx;
    const dom = cheerioPortadom($.root(), request.loadedUrl || request.url);
    const entries = await partnersDOMActions.extractPartnerEntries({ dom, log });

    await pushData(entries, { ...pushDataOptions, privacyMask: {} });
  },
};
