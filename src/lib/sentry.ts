import * as Sentry from '@sentry/node';

export const setupSentry = ({ enabled }: { enabled: boolean }) => {
  if (!enabled) return;

  Sentry.init({
    serverName: 'apify-actor-profesia-sk',
    dsn: 'https://5b2e0562b4ec4ef6805a3fbbf4ff8acd@o470159.ingest.sentry.io/4505019830370304',

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
};
