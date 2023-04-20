import { Actor, Log } from 'apify';
import {
  BasicCrawlingContext,
  CheerioCrawlingContext,
  CrawlingContext,
  HttpCrawlingContext,
  JSDOMCrawlingContext,
  PlaywrightCrawlingContext,
  PuppeteerCrawlingContext,
  playwrightUtils,
} from 'crawlee';
import type { Page } from 'playwright';
import * as Sentry from '@sentry/node';

import type { MaybePromise } from '../utils/types';
import type { RouteHandler } from './router';

type RouteHandlerCtx<Ctx extends CrawlingContext> = Parameters<RouteHandler<Ctx>>[0]; // prettier-ignore

interface CaptureErrorInput {
  error: Error;
  page?: Page;
  /** URL where the error happened. If not given URL is taken from the Page object */
  url?: string;
  log?: Log;
}

type CaptureError = (input: CaptureErrorInput) => MaybePromise<void>;

const REPORTING_DATASET_ID = 'REPORTING';

/**
 * Error handling for Apify actors.
 *
 * See https://docs.apify.com/academy/node-js/analyzing-pages-and-fixing-errors#error-reporting
 */
const handleApifyError = async (
  fn: (input: { captureError: CaptureError }) => MaybePromise<void>
) => {
  // Let's create reporting dataset
  // If you already have one, this will continue adding to it
  const reportingDataset = await Actor.openDataset(REPORTING_DATASET_ID);

  // storeId is ID of current key-value store, where we save snapshots
  const storeId = Actor.getEnv().defaultKeyValueStoreId;

  // We can also capture actor and run IDs
  // to have easy access in the reporting dataset
  const { actorId, actorRunId } = Actor.getEnv();
  const actorRunUrl = `https://console.apify.com/actors/${actorId}/runs/${actorRunId}`;

  const captureError = async ({
    error,
    page,
    url: givenUrl,
    log: parentLog,
  }: {
    error: Error;
    page?: Page;
    /** URL where the error happened. If not given URL is taken from the Page object */
    url?: string;
    log?: Log;
  }) => {
    const log = parentLog?.child({ prefix: '[Error capture] ' });

    log?.error(`ERROR ${error.name}: ${error.message}`, error);
    console.error(`ERROR ${error.name}: ${error.message}`, error);

    const randomNumber = Math.random();
    const key = `ERROR-${randomNumber}`;

    let pageScreenshot: string | null = null;
    let pageHtmlSnapshot: string | null = null;
    let pageUrl: string | null = givenUrl ?? null;
    if (page) {
      pageUrl = pageUrl || page.url();
      log?.info('Capturing page snapshot');
      await playwrightUtils.saveSnapshot(page, { key });
      log?.info('DONE capturing page snapshot');
      // You will have to adjust the keys if you save them in a non-standard way
      pageScreenshot = `https://api.apify.com/v2/key-value-stores/${storeId}/records/${key}.jpg?disableRedirect=true`;
      pageHtmlSnapshot = `https://api.apify.com/v2/key-value-stores/${storeId}/records/${key}.html?disableRedirect=true`;
    }

    // We create a report object
    const report = {
      actorId,
      actorRunId,
      actorRunUrl,
      errorName: error.name,
      errorMessage: error.toString(),

      pageUrl,
      pageHtmlSnapshot,
      pageScreenshot,
    };

    log?.error('[Error capture] Error captured', report);

    // And we push the report
    log?.info(`[Error capture] Pushing error to dataset ${REPORTING_DATASET_ID}`);
    await reportingDataset.pushData(report);
    log?.info(`[Error capture] DONE pushing error to dataset ${REPORTING_DATASET_ID}`);

    Sentry.captureException(error, { extra: report });

    // @ts-expect-error Tag the error, so we don't capture it twice.
    error._apifyActorErrorCaptured = true;
    // Propagate the error
    throw error;
  };

  try {
    // Pass the error capturing function to the wrapped function, so it can trigger it by itself
    await fn({ captureError });
  } catch (error: any) {
    if (!error._apifyActorErrorCaptured) {
      // And if the wrapped function fails, we capture error for them
      await captureError({ error });
    }
  }
};

/**
 * Drop-in replacement for regular request handler callback for Crawlee route
 * (in the context of Apify) that automatically tracks errors.
 *
 * @example
 *
 * router.addDefaultHandler(
 *  handlerWithApifyErrorCapture(async (ctx) => {
 *    const { page, crawler } = ctx;
 *    const url = page.url();
 *    ...
 *  })
 * );
 */
export const handlerWithApifyErrorCapture = <Ctx extends CrawlingContext>(
  handler: (ctx: RouteHandlerCtx<Ctx> & { captureError: CaptureError }) => MaybePromise<void>
) => {
  // Wrap the original handler, so we can additionally pass it the captureError function
  const wrapperHandler = (ctx: Parameters<RouteHandler<Ctx>>[0]) => {
    return handleApifyError(({ captureError }) => {
      return handler({
        ...ctx,
        // And automatically feed contextual args (page, url, log) to captureError
        captureError: (input) => captureError({ ...input, ...ctx, url: ctx.request.url }),
      });
    });
  };
  return wrapperHandler;
};

export const basicHandlerWithApifyErrorCapture = <Ctx extends BasicCrawlingContext>(...args: Parameters<typeof handlerWithApifyErrorCapture<Ctx>>) => handlerWithApifyErrorCapture<Ctx>(...args); // prettier-ignore
export const httpHandlerWithApifyErrorCapture = <Ctx extends HttpCrawlingContext>(...args: Parameters<typeof handlerWithApifyErrorCapture<Ctx>>) => handlerWithApifyErrorCapture<Ctx>(...args); // prettier-ignore
export const jsdomHandlerWithApifyErrorCapture = <Ctx extends JSDOMCrawlingContext>(...args: Parameters<typeof handlerWithApifyErrorCapture<Ctx>>) => handlerWithApifyErrorCapture<Ctx>(...args); // prettier-ignore
export const playwrightHandlerWithApifyErrorCapture = <Ctx extends PlaywrightCrawlingContext>(...args: Parameters<typeof handlerWithApifyErrorCapture<Ctx>>) => handlerWithApifyErrorCapture<Ctx>(...args); // prettier-ignore
export const cheerioHandlerWithApifyErrorCapture = <Ctx extends CheerioCrawlingContext>(...args: Parameters<typeof handlerWithApifyErrorCapture<Ctx>>) => handlerWithApifyErrorCapture<Ctx>(...args); // prettier-ignore
export const puppeteerHandlerWithApifyErrorCapture = <Ctx extends PuppeteerCrawlingContext>(...args: Parameters<typeof handlerWithApifyErrorCapture<Ctx>>) => handlerWithApifyErrorCapture<Ctx>(...args); // prettier-ignore
