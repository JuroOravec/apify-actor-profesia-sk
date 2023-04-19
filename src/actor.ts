import { Actor } from 'apify';
import { PlaywrightCrawler, PlaywrightCrawlerOptions } from 'crawlee';

import type { ProfesiaSkActorInput } from './types';
import { stats } from './lib/stats';
import { setupSentry } from './lib/sentry';
import { setupRouter } from './router';
import { datasetTypeToUrl } from './constants';

setupSentry({ enabled: !!process.env.APIFY_IS_AT_HOME });

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
//       - By position(s) (eg https://www.profesia.sk/praca/zoznam-pozicii/, https://www.profesia.sk/praca/account-manager/)
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
// 3 List of Positions (https://www.profesia.sk/praca/zoznam-pozicii/)
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

export const run = async (crawlerConfig?: PlaywrightCrawlerOptions): Promise<void> => {
  // See docs:
  // - https://docs.apify.com/sdk/js/
  // - https://docs.apify.com/academy/deploying-your-code/inputs-outputs#accepting-input-with-the-apify-sdk
  // - https://docs.apify.com/sdk/js/docs/upgrading/upgrading-to-v3#apify-sdk
  await Actor.main(
    async () => {
      const inputs = (await Actor.getInput<ProfesiaSkActorInput>()) || ({} as ProfesiaSkActorInput);
      validateActorInput(inputs);

      const crawler = await createCrawler(inputs, crawlerConfig);

      const startUrls: string[] = [];
      if (inputs.startUrls) startUrls.push(...inputs.startUrls);
      else startUrls.push(datasetTypeToUrl[inputs.datasetType!]);

      await crawler.run(startUrls);
    },
    { statusMessage: 'Crawling finished!' }
  );
};

const createCrawler = async (
  input: ProfesiaSkActorInput,
  crawlerConfig?: PlaywrightCrawlerOptions
) => {
  const { router } = await setupRouter(input);

  const proxyConfiguration = process.env.APIFY_IS_AT_HOME
    ? await Actor.createProxyConfiguration()
    : undefined;

  return new PlaywrightCrawler({
    proxyConfiguration,
    headless: true,
    // See https://docs.apify.com/academy/expert-scraping-with-apify/solutions/rotating-proxies
    // useSessionPool: true,
    // sessionPoolOptions: {},

    // Handle all failed requests
    failedRequestHandler: async ({ error, request }) => {
      // Add an error for this url to our error tracker
      stats.addError(request.url, (error as Error)?.message);
    },
    requestHandler: router,
    ...crawlerConfig,
  });
};

const validateActorInput = (input: ProfesiaSkActorInput) => {
  if (!input.startUrls && !input.datasetType) {
    throw Error(
      `Missing instruction for scraping - either startUrls or datasetType MUST be specified. INPUT: ${JSON.stringify(
        input
      )}`
    );
  }

  if (input.startUrls && input.datasetType) {
    throw Error(
      `Ambiguous instruction for scraping - only ONE of startUrls or datasetType MUST be specified. INPUT: ${JSON.stringify(
        input
      )}`
    );
  }

  if (!input.startUrls && !datasetTypeToUrl[input.datasetType!]) {
    throw Error(`Invalid value for datasetType option. Got ${input.datasetType}, but allowed values are ${JSON.stringify(Object.keys(datasetTypeToUrl))} `); // prettier-ignore
  }
};
