import type { Log } from 'apify';
import type { Page, Route } from 'playwright';
import fetch from 'node-fetch';
import { pick } from 'lodash';

import type {
  CategoriesQueryRequestPayload,
  CategoriesQueryResponsePayload,
  MaybePromise,
} from '../types';

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
export const storePageActions = {
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

    await page.route(storePageActions.urlIsItemsQuery, routeHandler);

    const dispose = () => {
      return page.unroute(storePageActions.urlIsItemsQuery, routeHandler);
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
