import {
  BasicCrawler,
  CrawlingContext,
  PlaywrightCrawlingContext,
  PuppeteerCrawlingContext,
  RouterHandler,
} from 'crawlee';
import type { CommonPage } from '@crawlee/browser-pool';

import { handlerWithApifyErrorCapture } from './errorHandler';
import type { MaybePromise } from '../utils/types';
import { serialAsyncMap } from '../utils/async';

/** Function that's passed to router.addHandler  */
export type RouteHandler<Ctx extends CrawlingContext = CrawlingContext<BasicCrawler>> = Parameters<RouterHandler<Ctx>['addHandler']>[1]; // prettier-ignore

export interface RouteMatcher<
  Labels extends Record<string, unknown> = Record<string, unknown>,
  Ctx extends CrawlingContext = CrawlingContext<BasicCrawler>
> {
  name: string;
  to: Exclude<keyof Labels, symbol> | null;
  match: (
    url: string,
    ctx: Ctx,
    route: RouteMatcher,
    handlers: Record<keyof Labels, RouteHandler<Ctx>>
  ) => unknown;
  action?: (
    url: string,
    ctx: Ctx,
    route: RouteMatcher,
    handlers: Record<keyof Labels, RouteHandler<Ctx>>
  ) => MaybePromise<void>;
}

export const createRouteMatchers = <
  Labels extends Record<string, unknown>,
  Ctx extends CrawlingContext = CrawlingContext<BasicCrawler>
>(
  matchers: RouteMatcher<Labels, Ctx>[]
) => matchers;

export const createPlaywrightRouteMatchers = <
  Labels extends Record<string, unknown>,
  Ctx extends PlaywrightCrawlingContext = PlaywrightCrawlingContext
>(
  matchers: RouteMatcher<Labels, Ctx>[]
) => matchers;

export const createPuppeteerRouteMatchers = <
  Labels extends Record<string, unknown>,
  Ctx extends PuppeteerCrawlingContext = PuppeteerCrawlingContext
>(
  matchers: RouteMatcher<Labels, Ctx>[]
) => matchers;

export const registerHandlers = async <
  Labels extends Record<string, unknown>,
  Ctx extends CrawlingContext = CrawlingContext
>(
  router: RouterHandler<Ctx>,
  handlers: Record<keyof Labels, RouteHandler<Ctx>>
) => {
  await serialAsyncMap(Object.entries(handlers), async ([key, handler]) => {
    await router.addHandler(key, handler as any);
  });
};

/**
 * Configures the default router handler to redirect URLs to labelled route handlers
 * based on which route the URL matches first.
 *
 * NOTE: This does mean that the URLs passed to this default handler will be fetched
 * twice (as the URL will be requeued to the correct handler). We recommend to use this
 * function only in the scenarios where there is a small number of startUrls, yet these
 * may need various ways of processing based on different paths or etc.
 *
 * @example
 *
 * const routeLabels = {
 *   MAIN_PAGE: 'MAIN_PAGE',
 *   JOB_LISTING: 'JOB_LISTING',
 *   JOB_DETAIL: 'JOB_DETAIL',
 *   JOB_RELATED_LIST: 'JOB_RELATED_LIST',
 *   PARTNERS: 'PARTNERS',
 * } as const;
 *
 * const router = createPlaywrightRouter();
 *
 * const routes = createPlaywrightRouteMatchers<typeof routeLabels>([
 *  // URLs that match this route are redirected to router.addHandler(routeLabels.MAIN_PAGE)
 *  {
 *     route: routeLabels.MAIN_PAGE,
 *     // Check for main page like https://www.profesia.sk/?#
 *     match: (url) => url.match(/[\W]profesia\.sk\/?(?:[?#~]|$)/i),
 *   },
 *
 *  // Optionally override the logic that assigns the URL to the route by specifying the `action` prop
 *  {
 *     route: routeLabels.MAIN_PAGE,
 *     // Check for main page like https://www.profesia.sk/?#
 *     match: (url) => url.match(/[\W]profesia\.sk\/?(?:[?#~]|$)/i),
 *     action: async (ctx) => {
 *       await ctx.crawler.addRequests([{
 *         url: 'https://profesia.sk/praca',
 *         label: routeLabels.JOB_LISTING,
 *       }]);
 *     },
 *   },
 * ]);
 *
 * // Set up default route to redirect to labelled routes
 * setupDefaultRoute(router, routes);
 *
 * // Now set up the labelled routes
 * await router.addHandler(routeLabels.JOB_LISTING, async (ctx) => { ... }
 */
export const setupDefaultRoute = async <
  Labels extends Record<string, unknown>,
  Ctx extends CrawlingContext
>(
  router: RouterHandler<Ctx>,
  routes: RouteMatcher<Labels, Ctx>[],
  handlers: Record<keyof Labels, RouteHandler<Ctx>>
) => {
  /** Redirect the URL to the labelled route identical to route's name */
  const defaultAction: RouteMatcher<Labels, Ctx>['action'] = async (url, ctx, route) => {
    const handler = route.to != null && handlers[route.to];
    if (!handler) {
      ctx.log.error(`No handler found for route ${route.name} (${route.to}). URL will not be processed. URL: ${url}`); // prettier-ignore
      return;
    }
    ctx.log.info(`Passing URL to handler ${route.to}. URL: ${url}`);
    await handler(ctx);
  };

  await router.addDefaultHandler<Ctx>(
    handlerWithApifyErrorCapture(async (ctx) => {
      const { page, log: parentLog } = ctx;
      const log = parentLog.child({ prefix: '[Router] ' });
      const url = await (page as CommonPage).url();

      let route: RouteMatcher<Labels, Ctx>;
      for (const currRoute of routes) {
        if (await currRoute.match(url, ctx as any, currRoute as any, handlers)) {
          route = currRoute;
          break;
        }
      }

      if (!route!) {
        log.error(`No route matched URL. URL will not be processed. URL: ${url}`); // prettier-ignore
        return;
      }
      log.info(`URL matched route ${route.name} (${route.to}). URL: ${url}`);
      await (route.action ?? defaultAction)(url, ctx as any, route as any, handlers);
    })
  );
};
