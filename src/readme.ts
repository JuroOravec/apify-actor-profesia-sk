import { ApifyReadmeTemplatesOverrides, renderReadme } from 'apify-actor-utils';

import actorSpec from './actorspec';

const templates = {
  input: {
    maxCount: 'jobOfferFilterMaxCount',
    privacyName: 'Include personal data',
  },

  perfTables: {
    jobOffers: {
      rows: [
        { rowId: 'fast', template: 'Fast run' },
        { rowId: 'detailed', template: 'Detailed run' },
      ],
      cols: [
        { colId: '1000items', template: '1000 results' },
        { colId: 'fullRun', template: 'Full run (~ <%~ it.fn.millify(it.dataset.size) %> results)' }, // prettier-ignore
      ],
    },
    // Table for small datasets where multiple cols don't make sense
    other: {
      rows: [{ rowId: 'default', template: 'Run' }],
      cols: [
        { colId: 'fullRun', template: 'Full run (~ <%~ it.fn.millify(it.dataset.size) %> results)' }, // prettier-ignore
      ],
    },
  },

  exampleInputs: [
    {
      title: `Get summary of all job offers in last 20 days for full-time on-site cooks with salary 6+ eur/hr`,
      inputData: {
        datasetType: 'jobOffers',
        jobOfferFilterEmploymentType: 'fte',
        jobOfferFilterLastNDays: 20,
        jobOfferFilterMinSalaryPeriod: 'hour',
        jobOfferFilterMinSalaryValue: 6,
        jobOfferFilterQuery: 'kuchar',
        jobOfferFilterRemoteWorkType: 'noRemote',
      },
    },
    {
      title: `Same as above, but specified by providing a custom search results URL`,
      inputData: {
        startUrls: [
          'https://www.profesia.sk/praca/kuchar/plny-uvazok/?count_days=20&remote_work=0&salary=6&salary_period=h',
        ],
      },
    },
    {
      title: `(Advanced) Same as above, but re-configure the crawler to increase the request timeout to 5 min and request retries to 5`,
      inputData: {
        startUrls: [
          'https://www.profesia.sk/praca/kuchar/plny-uvazok/?count_days=20&remote_work=0&salary=6&salary_period=h',
        ],
        requestHandlerTimeoutSecs: 300,
        maxRequestRetries: 5,
      },
    },
  ],

  hooks: {
    introAfterBegin: `
[Profesia](https://www.profesia.sk) - Is the leading Slovak job board in Slovakia.`,

    useCases: `
Companies
  - Analyse competitors' job offers and recruitment strategies.
  - Create competitive salary packages + perks based on the information like salary or remote options.
  - Analyze the effectiveness of job advertisements and optimize their recruitment marketing strategies.

Recruiters
  - Automate the process of finding job offers for your clients.

Analysists
  - Analyze job market trends like salary expectations, popular job types, and in-demand skills.
  - Study the regional job market trends.`,

    costAfterPerfTables: `
Checking for new job offers every day => costs less than $1 per month ($0.713 = 31 * $0.023).

NOTE: Prices for job offer data are only indicative, based on runs of 200 entries.`,

    costBeforeEnd: `### Other datasets

List of companies, professions, locations, industries, partners, etc, are all around $0.038 (24s) per run.`,

    filterBeforeEnd: `
Alternatively, you can set up [a custom search filter](https://www.profesia.sk/search_offers.php),
and pass the resulting
[search results URL](https://www.profesia.sk/praca/skrateny-uvazok/?count_days=1&positions[]=40&salary=1000&salary_period=m&skills[]=73_15_5_12)
to the \`startUrls\` input option.

Hence you can e.g. use Profesia.sk Scraper to dynamically check for existence of certain job offers.`,
  },
} satisfies ApifyReadmeTemplatesOverrides;

renderReadme({ filepath: './.actor/README.md', actorSpec, templates });
