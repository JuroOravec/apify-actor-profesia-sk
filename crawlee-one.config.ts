import type { CrawleeOneConfig } from 'crawlee-one';

const config: CrawleeOneConfig = {
  version: 1,
  schema: {
    crawlers: {
      profesia: {
        type: 'cheerio',
        routes: [
          'mainPage',
          'jobListing',
          'jobDetail',
          'jobRelatedList',
          'companyDetailCustom',
          'partners',
        ],
      },
    },
  },
};

export default config;
