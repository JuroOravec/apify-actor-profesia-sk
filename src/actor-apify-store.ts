import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { keyBy } from 'lodash';

import { poll } from './utils';
import type { ApifyActorStoreItem, ApifyStoreActorInput } from './types';
import { storePageActions } from './page-actions/store';

export const run = async (): Promise<void> => {
  // See docs:
  // - https://docs.apify.com/sdk/js/
  // - https://docs.apify.com/academy/deploying-your-code/inputs-outputs#accepting-input-with-the-apify-sdk
  // - https://docs.apify.com/sdk/js/docs/upgrading/upgrading-to-v3#apify-sdk
  await Actor.main(
    async () => {
      const { startUrls, query, category } = (await Actor.getInput<ApifyStoreActorInput>()) || {};

      const crawler = await createCrawler({
        query,
        categoriesByText: category ? [category] : undefined,
      });

      await crawler.run(startUrls);
    },
    { statusMessage: 'Crawling finished!' }
  );
};

/**
 * Mapping of categories as show in the web and the filter option for network request
 *
 * We have to keep this here, so we can answer these questions:
 * - When we receive a response for a network request with a certain category filter,
 *   which category button in the UI does it correspond to?
 * - Do we have to wait for a network response after clicking on a button?
 *
 * This is unfortunate as it means we have to keep it up-to-date manually.
 */
const CATEGORIES = [
  { text: 'ai', filter: 'AI' },
  { text: 'automation', filter: 'AUTOMATION' },
  { text: 'business', filter: 'BUSINESS' },
  { text: 'covid-19', filter: 'COVID_19' },
  { text: 'developer examples', filter: 'DEVELOPER_EXAMPLES' },
  { text: 'developer tools', filter: 'DEVELOPER_TOOLS' },
  { text: 'e-commerce', filter: 'ECOMMERCE' },
  { text: 'games', filter: 'GAMES' },
  { text: 'jobs', filter: 'JOBS' },
  { text: 'marketing', filter: 'MARKETING' },
  { text: 'news', filter: 'NEWS' },
  { text: 'seo tools', filter: 'SEO_TOOLS' },
  { text: 'social media', filter: 'SOCIAL_MEDIA' },
  { text: 'travel', filter: 'TRAVEL' },
  { text: 'videos', filter: 'VIDEOS' },
  { text: 'real estate', filter: 'REAL_ESTATE' },
  { text: 'sports', filter: 'SPORTS' },
  { text: 'education', filter: 'EDUCATION' },
  { text: 'other', filter: 'OTHER' },
];
const CATEGORIES_BY_TEXT = keyBy(CATEGORIES, (c) => c.text);
const CATEGORIES_BY_FILTER = keyBy(CATEGORIES, (c) => c.filter);

interface ApifyStoreActorOptions {
  query?: string;
  categoriesByText?: string[];
}

const createCrawler = async (input?: ApifyStoreActorOptions) => {
  const { query, categoriesByText } = input || {};

  const proxyConfiguration = process.env.APIFY_IS_AT_HOME
    ? await Actor.createProxyConfiguration()
    : undefined;

  return new PlaywrightCrawler({
    proxyConfiguration,
    headless: false,
    requestHandler: async ({ page, log }) => {
      log.info('Received inputs', { query, categoriesByText });

      const categLocators = await storePageActions.getCategories({
        page,
        categoriesByText,
        logger: log,
      });

      // 1) The request that fetches ALL items on the store page doesn't
      // include info on actor CATEGORIES.
      // 2) When we visit a category, a network request is made to fetch items
      // belonging ONLY to that category.
      // 3) HENCE, to deal with 1), we visit all categories, fetch items from the categories,
      // and then assign the categories to the items based on which datasets
      // we found the items in.
      const allItemsById: Record<string, ApifyActorStoreItem> = {};

      const processItem = (item: ApifyActorStoreItem, category: string) => {
        // Add category to the already-seen item
        if (allItemsById[item.objectID]) {
          allItemsById[item.objectID].categories!.push(category);
          return;
        } else {
          // Remember the item
          allItemsById[item.objectID] = item;
          item.categories = [category];
        }
      };

      // With given approach (intercepting requests) there can be a race condition between:
      // 1) The time we start "waiting for response" from the intercepted network request
      // 2) When the response actually arrives.
      //
      // In other words, if response comes back BEFORE we start waiting for response, we get stuck.
      //
      // HENCE, we use this state to know which network requests (for which categories)
      // have already been intercepted.
      const interceptedCategories = new Set<string>();

      // And hence, we set up a network request interception, and when we come across
      // a request made for specific category, we fetch all it's items.
      const disposeIntercept = await storePageActions.setupCategoriesIntercept({
        page,
        logger: log,

        // If, whilst navigating the store page:
        // 1) We find a network request that fetches store items for a specific category
        // AND 2) We've not scraped that category YET
        // THEN, fetch all items of that category.
        onDetectedCategory: async ({ url, payload, headers }) => {
          const category = payload.filters?.split(':')[1];

          // Remember that we've visited this category
          const categData = CATEGORIES_BY_FILTER[category!];
          if (!categData) {
            log.warning(`Unrecognized filter category "${category}" - Please contact the developer of this actor so they add this category to the scraped items.`); // prettier-ignore
          }
          interceptedCategories.add(category!);

          await storePageActions.fetchStoreItems({
            fetchOptions: { url, headers },
            // Insert our custom query from actor input
            payload: query ? { ...payload, query } : payload,
            logger: log,
            onData: (data) => {
              data.hits?.forEach((d) => processItem(d, category!));
            },
          });
        },
      });

      let cookieConsentClicked = false;
      const cookieConsentBtnLoc = page.locator('#onetrust-accept-btn-handler');

      // To trigger the network requests to fetch items by categories,
      // we manually visit individual categories.
      for (const categLocator of categLocators) {
        // Cookie content overlay may stand in our way
        log.info('Checking presence of cookie consent window');
        if (!cookieConsentClicked && (await cookieConsentBtnLoc.count())) {
          log.info('Clicking away cookie consent window');
          await cookieConsentBtnLoc.click({ timeout: 5000 });
          log.info('Clicking away cookie consent window DONE');
          cookieConsentClicked = true;
        } else {
          log.info('Cookie consent window not found');
        }

        const categText = (await categLocator.textContent())?.trim();

        // Click on a category button and wait till it loads
        log.info(`Clicking on category "${categText}"`);
        await categLocator.click();

        // Wait for the network request we want to intercept
        log.info(`Waiting for response for category "${categText}"`);
        await Promise.race([
          // Either wait for network response
          page.waitForResponse((res) => storePageActions.urlIsItemsQuery(res.url())),
          // Or, if the network response has already arrived while we were setting this up,
          // then also regularly check if we've already visited this category
          poll(() => {
            const { filter } = CATEGORIES_BY_TEXT[categText!.toLocaleLowerCase()] || {};
            if (filter) return interceptedCategories.has(filter);

            log.warning(`Unrecognized filter category "${categText}" - Please contact the developer of this actor so they add this category to the scraped items.`); // prettier-ignore
          }, 50),
        ]);
        log.info(`DONE Waiting for response for category "${categText}"`);

        await new Promise((res) => setTimeout(res, 500));
      }

      await Actor.pushData(Object.values(allItemsById));

      // Cleanup
      await disposeIntercept();
    },
  });
};
