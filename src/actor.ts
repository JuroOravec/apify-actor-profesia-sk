import type { CheerioCrawlerOptions } from 'crawlee';
import { crawleeOne, createSentryTelemetry } from 'crawlee-one';

import {
  companyDetailCustomRoute,
  jobDetailRoute,
  jobListingRoute,
  jobRelatedListRoute,
  mainPageRoute,
  partnersRoute,
} from './routes';
import { datasetTypeToUrl } from './constants';
import { validateInput } from './validation';
import { getPackageJsonInfo } from './utils/package';
import { profesiaCrawler } from './__generated__/crawler';
import type { ActorInput } from './config';

// Flow:
// 1 Jobs (https://www.profesia.sk/praca/)
//   1.0 Filter (applies to all cases)
//     1.1.-1 DEBUG - don't scrape entries, just return the number of results
//     1.1.0 Detailed - If true, visits pages of individual offers. if false, it returns only the data found on listings page (which is 20x faster/less requests).
//     1.1.1 Up to N results
//     1.1.2 Work from home filter (eg https://www.profesia.sk/praca/administrativny-pracovnik-referent/?remote_work=1)
//     1.1.3 Salary filter (500, 1000, 1500, ..., but can set own numbers)
//       1.1.3.1 by month https://www.profesia.sk/praca/administrativny-pracovnik-referent/?salary=1500&salary_period=m
//       1.1.3.2 by hour https://www.profesia.sk/praca/administrativny-pracovnik-referent/?salary=6&salary_period=h)
//     1.1.4 employment type filter (eg https://www.profesia.sk/praca/administrativny-pracovnik-referent/plny-uvazok/)
//     1.1.5 last N days (1, 2, 7, 31) - but can be custom, like count_days=21
//
//   1.1 Jobs - General search
//
//   1.2 Jobs - By custom filter - custom URL (eg https://www.profesia.sk/praca/bratislavsky-kraj/plny-uvazok/?remote_work=1&salary=500&salary_period=m)
//     - because of how the website is structured, these kind of filters cannot be set from the console
//     - because the available filters are not known ahead of time
//     - redirect them to here to create custom filters https://www.profesia.sk/search_offers.php
//
//     - Mention that by using custom URLs, they can filter by:
//       - By geo area(s) (eg https://www.profesia.sk/praca/zoznam-lokalit/, https://www.profesia.sk/praca/okres-galanta/)
//       - By profession(s) (eg https://www.profesia.sk/praca/zoznam-pozicii/, https://www.profesia.sk/praca/account-manager/)
//       - By industry(ies) (eg https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/, https://www.profesia.sk/praca/pomocne-prace/)
//       - By language requirement(s) (eg https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/)
//       - By employer(s) (eg https://www.profesia.sk/praca/zoznam-spolocnosti, https://www.profesia.sk/praca/22media/C237397)
//         - Oh no, looks like employers can modify their pages?
//           - https://www.profesia.sk/praca/accenture/C3691
//           - https://www.profesia.sk/praca/adient-slovakia/C206117
//           - https://www.profesia.sk/praca/aceqes/C116288
//
// 2 List of Industries (https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/)
//   - no options there, just return name, link, count
//
// 3 List of Professions (https://www.profesia.sk/praca/zoznam-pozicii/)
//   - no options there, just return name, link, count
//
// 4 List of Languages (https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/)
//   - no options there, just return name, link, count
//
// 5 List of Companies (https://www.profesia.sk/praca/zoznam-spolocnosti/)
//   - no options there, just return name, link, count
//
// 6 List of Locations (https://www.profesia.sk/praca/zoznam-lokalit/)
//   - no options there, just return name, link, count
//
// 7 List of Partners (https://www.profesia.sk/partneri)
//   - no options there, just return name, img, desc, link, type (Špecializované / Regionálne servery)
//
// Out of scope:
// 1 Jobs Automation
//   1.1 "Saving" entries that meet certain criteria
// 2 Companies Automation
//
//
// Why not use their API?
// - It's available only to partners (so they can reshare content), and you need to pay for it.
//   - https://podpora.profesia.sk/897202-Export-pracovn%C3%BDch-pon%C3%BAk

/** Crawler options that **may** be overriden by user input */
const crawlerConfigDefaults: CheerioCrawlerOptions = {
  maxRequestsPerMinute: 120,
  // NOTE: Listing page request handler might fetch 20 requests (offer details), so we want to give it time
  requestHandlerTimeoutSecs: 180,
  // headless: true,
  // maxRequestsPerCrawl: 20,

  // SHOULD I USE THESE?
  // See https://docs.apify.com/academy/expert-scraping-with-apify/solutions/rotating-proxies
  // useSessionPool: true,
  // sessionPoolOptions: {},
};

export const run = async (crawlerConfigOverrides?: CheerioCrawlerOptions): Promise<void> => {
  const pkgJson = getPackageJsonInfo(module, ['name']);

  const telemetry = createSentryTelemetry({
    dsn: 'https://5b2e0562b4ec4ef6805a3fbbf4ff8acd@o470159.ingest.sentry.io/4505019830370304',
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
    serverName: pkgJson.name,
  });

  await crawleeOne<'cheerio'>({
    // Use the 'cheerio' crawlee Crawleer class
    type: 'cheerio',
    routes: {
      mainPage: {
        // Use this handler if its URL matches this regex
        match: /example\.com\/home/i,
        handler: async (ctx) => {
          const { $, pushData, pushRequests } = ctx;

          // NOTE: The Cheerio Crawler automatically parses the HTML to Cheerio
          const posts = $('.post');
          const data = posts.toArray().map((el) => {
            const title = ctx.$(el).find('.title').text();
            const author = ctx.$(el).find('.author').text();
            return { title, author };
          });

          // Save the scraped data by "pushing them to the dataset"
          // By default, if running locally, the data will be saved to `./storage/datasets/default`
          await pushData(
            data, // Data to push to the dataset
            { privacyMask: { author: true } } // Declare private fields
          );

          // Enqueue more URLs to scrape by "pushing them to the request queue"
          // By default, if running locally, this is available at `./storage/requests_queues/default`
          const nextPageUrl = $('.next-page').prop('href');
          if (nextPageUrl) await pushRequests({ url: nextPageUrl });
        },
      },
    },
  });

  await crawleeOne<'playwright'>({
    type: 'playwright',
    routes: {
      mainPage: {
        match: /example\.com\/home/i,
        handler: (ctx) => {
          ctx.parseWithCheerio();
          // ...
        },
      },
    },
  });

  await profesiaCrawler<ActorInput>({
    telemetry,
    crawlerConfig: crawlerConfigOverrides,
    crawlerConfigDefaults,
    hooks: {
      validateInput,
      onReady: async (actor) => {
        const startUrls: string[] = [];
        if (!actor.startUrls.length && actor.input?.datasetType) {
          startUrls.push(datasetTypeToUrl[actor.input?.datasetType]);
        }
        await actor.runCrawler(startUrls);
      },
    },
    routes: {
      mainPage: mainPageRoute,
      jobDetail: jobDetailRoute,
      companyDetailCustom: companyDetailCustomRoute,
      jobRelatedList: jobRelatedListRoute,
      jobListing: jobListingRoute,
      partners: partnersRoute,
    },
  });
};
