import { Actor, Log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import type { Page, Route } from 'playwright';
import fetch from 'node-fetch';
import { pick } from 'lodash';

import type {
  ApifyActorStoreItem,
  ApifyStoreActorInput,
  CategoriesQueryRequestPayload,
  CategoriesQueryResponsePayload,
  MaybePromise,
} from './types';

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
      const categLocators = await storePage.getCategories({ page, categoriesByText, logger: log });

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

      // And hence, we set up a network request interception, and when we come across
      // a request made for specific category, we fetch all it's items.
      const disposeIntercept = await storePage.setupCategoriesIntercept({
        page,
        logger: log,

        // If, whilst navigating the store page:
        // 1) We find a network request that fetches store items for a specific category
        // AND 2) We've not scraped that category YET
        // THEN, fetch all items of that category.
        onDetectedCategory: async ({ url, payload, headers }) => {
          const category = payload.filters?.split(':')[1];
          await storePage.fetchStoreItems({
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

        // Click on a category button and wait till it loads
        log.info(`Clicking on category "${await categLocator.textContent()}"`);
        await categLocator.click();
        // Wait for the network request we want to intercept
        log.info(`Waiting for response for category "${await categLocator.textContent()}"`);
        await page.waitForResponse((res) => storePage.urlIsItemsQuery(res.url()));

        await new Promise((res) => setTimeout(res, 500));
      }

      await Actor.pushData(Object.values(allItemsById));

      // Cleanup
      await disposeIntercept();
    },
  });
};

/** Example of how the payload looks, but we try to use data from actual Request */
const STORE_PAGE_FETCH_ITEMS_DEFAULT_PAYLOAD: CategoriesQueryRequestPayload = {
  query: '',
  page: 0,
  hitsPerPage: 24,
  restrictSearchableAttributes: [],
  attributesToHighlight: [],
  attributesToRetrieve: ['title', 'name', 'username', 'userFullName', 'stats', 'description', 'pictureUrl', 'userPictureUrl', 'notice', 'currentPricingInfo'], // prettier-ignore
};

/**
 * Example of how the request looks. But we try to take the actual values
 * from an intercepted Request, so we've got the right endpoint and API key.
 */
const STORE_PAGE_FETCH_ITEMS_DEFAULT_FETCH_OPTIONS = {
  url: 'https://ow0o5i3qo7-dsn.algolia.net/1/indexes/prod_PUBLIC_STORE/query',
  headers: {
    accept: '*/*',
    'content-type': 'application/x-www-form-urlencoded',
    'x-algolia-api-key': '0ecccd09f50396a4dbbe5dbfb17f4525',
    'x-algolia-application-id': 'OW0O5I3QO7',
  } as any,
  referrer: 'https://console.apify.com/',
  referrerPolicy: 'origin',
  method: 'POST',
} satisfies Partial<Request>;

/** Actions defined for the store page */
const storePage = {
  urlIsItemsQuery: (inputUrl: URL | string) => {
    const url = typeof inputUrl === 'string' ? inputUrl : inputUrl.href;
    // https://ow0o5i3qo7-dsn.algolia.net/1/indexes/prod_PUBLIC_STORE/query
    return url.includes('algolia.net/1/indexes/prod_PUBLIC_STORE/query');
  },

  getCategories: async ({
    page,
    categoriesByText,
    logger,
  }: {
    page: Page;
    categoriesByText?: string[];
    logger: Log;
  }) => {
    const categMultiLoc = await page.locator('[data-test="sidebar-categories"] a');
    const categLocs = await categMultiLoc.all();
    if (!categoriesByText) return categLocs;

    // Select categories by their text content
    const normTxt = (t: string) => t.trim().toLocaleLowerCase();
    const searchedForTexts = categoriesByText.map(normTxt);
    const categLocTexts = (await categMultiLoc.allTextContents()).map(normTxt);
    const filteredCategLocs = categLocs.filter((_loc, index) => {
      return searchedForTexts.includes(categLocTexts[index]);
    });

    if (!filteredCategLocs.length) {
      logger.info(`None of available categories matched texts ${JSON.stringify(categoriesByText)}`);
    } else {
      logger.info(
        `${filteredCategLocs.length} categories matched texts ${JSON.stringify(categoriesByText)}`
      );
    }
    return filteredCategLocs;
  },

  /**
   * Set up network interception using playwright's Page.route(), so that we can extract the
   * data from the network payloads instead of from the HTML.
   */
  setupCategoriesIntercept: async ({
    page,
    logger,
    onDetectedCategory,
  }: {
    page: Page;
    onDetectedCategory: (ctx: {
      url: string;
      headers: Record<string, string>;
      payload: CategoriesQueryRequestPayload;
    }) => MaybePromise<void>;
    logger: Log;
  }) => {
    const categories = new Set();

    // See these for intercepting requests in Playwright
    // https://timdeschryver.dev/blog/intercepting-http-requests-with-playwright#using-the-original-response-to-build-a-mocked-response
    // https://playwright.dev/docs/api/class-page#page-route
    // https://playwright.dev/docs/api/class-route#route-fulfill
    const routeHandler = async (route: Route) => {
      const request = route.request();
      const url = request.url();
      const headers = request.headers();
      const postData = request.postData() || '{}';
      const payload = JSON.parse(postData) as CategoriesQueryRequestPayload;
      const { filters } = payload;

      await route.continue();

      if (filters && !categories.has(filters)) {
        logger.info(`Found store category filter "${filters}"`);
        categories.add(filters);
        await onDetectedCategory({ url, payload, headers });
        logger.info(`DONE onDetectedCategory for category filter ${payload.filters}`);
      }
    };

    await page.route(storePage.urlIsItemsQuery, routeHandler);

    const dispose = () => {
      return page.unroute(storePage.urlIsItemsQuery, routeHandler);
    };
    return dispose;
  },

  fetchStoreItems: async ({
    fetchOptions: inputFetchOptions,
    payload: inputPayload,
    logger,
    onData,
  }: {
    fetchOptions?: Omit<Partial<Request>, 'headers'> & { headers: Record<string, string> };
    payload?: Partial<CategoriesQueryRequestPayload>;
    onData: (data: CategoriesQueryResponsePayload) => MaybePromise<void>;
    logger: Log;
  }) => {
    const payload: CategoriesQueryRequestPayload = {
      ...STORE_PAGE_FETCH_ITEMS_DEFAULT_PAYLOAD,
      ...inputPayload,
      hitsPerPage: 500, // Note: Default is 24, but more hits = more faster.
    };

    const fetchOptions = {
      ...STORE_PAGE_FETCH_ITEMS_DEFAULT_FETCH_OPTIONS,
      ...inputFetchOptions,
      body: JSON.stringify(payload, null, 2) as any,
    };
    const url = fetchOptions.url;
    const headers = pick(
      fetchOptions.headers,
      Object.keys(STORE_PAGE_FETCH_ITEMS_DEFAULT_FETCH_OPTIONS.headers)
    );

    const queryState = JSON.stringify({ CATEGORY: payload.filters, QUERY: payload.query });

    while (true) {
      logger.info(`Fetching page ${payload.page + 1} for ${queryState}`);

      const response = await fetch(url, { ...fetchOptions, headers } as any);
      const data = (await response.json()) as CategoriesQueryResponsePayload;
      await onData(data);

      // Check if we've reached end of pagination
      const newItems = data.hits || [];
      if (!newItems.length || (data.nbHits && data.nbHits <= newItems.length)) {
        logger.info(
          `DONE fetching page ${payload.page + 1} for category filter ${payload.filters}`
        );
        break;
      }

      // Or continue to next page
      payload.page += 1;
      await new Promise((res) => setTimeout(res, 300));
    }
  },
};
