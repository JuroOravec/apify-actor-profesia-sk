// @ts-nocheck
import { Eta } from 'eta';
import fsp from 'fs/promises';
import path from 'path';
import millify from 'millify';
import { capitalize, cloneDeep, defaults, round, uniqBy } from 'lodash';
import type { DatasetPerfStat } from 'actor-spec';

import {
  ApifyReadmeTemplates,
  ApifyScraperActorSpec,
  README_HOOK,
  README_HOOK_ENUM,
  ReadmeFeature,
  ReadmeFeatureType,
  RenderContext,
} from './types';

export interface ApifyReadmeTemplatesOverrides extends Omit<ApifyReadmeTemplates, 'features'> {
  features?: Partial<Record<ReadmeFeatureType, Partial<ReadmeFeature>>>;
}

const eta = new Eta({
  rmWhitespace: false,
  autoTrim: false,
});

/**
 * Turn
 *
 * `[1, 2, 3, 4]`
 *
 * into
 *
 * `[{ item: 1, separator: ', '}, { item: 2, separator: ', '}, { item: 3, separator: ' or '}, { item: 4, separator: '' }]`
 *
 * So that the list can be rendered as:
 *
 * `1, 2, 3 or 4`
 */
const addListSeparators = <T>(arr: T[]) =>
  arr.map((item, index) => ({
    item,
    separator: index === arr.length - 1 ? '' : index === arr.length - 2 ? ' or ' : ', ',
  }));

/**
 * Render
 *
 * `[1, 2, 3, 4]`
 *
 * as
 *
 * `1, 2, 3 or 4`
 */
const renderList = (arr: any[]) => addListSeparators(arr)
  .map((d) => `${d.item}${d.separator}`)
  .join(''); // prettier-ignore

interface TimeDelta {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Given time in seconds, get the hours, minutes and seconds */
const timeDeltaFromSec = (timeInSec: number): TimeDelta => {
  const secInMin = 60;
  const secInHour = 60 * 60;
  let remainingTimeInSec = timeInSec;

  const hours = Math.floor(remainingTimeInSec / secInHour);
  remainingTimeInSec = remainingTimeInSec - hours * secInHour;

  const minutes = Math.floor(remainingTimeInSec / secInMin);
  const seconds = remainingTimeInSec - minutes * secInMin;
  return { hours, minutes, seconds };
};

/** Format time delta as "6h 2m 23s" or "2m 23s" */
const renderTimeDelta = ({ hours, minutes, seconds }: TimeDelta) => {
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', hours ? '' : `${seconds}s`].join(' '); // prettier-ignore
};

/** Render perf stat as "$0.016 in 0h 2m 23s" */
const renderPerfStat = (perf: DatasetPerfStat) => {
  const timeText = renderTimeDelta(timeDeltaFromSec(perf.timeSec));
  return `$${round(perf.costUsd, 3)} in ${timeText}`;
};

/** Render email safely as name[dot]surname[at]domain[dot]com */
const renderEmail = (email: string) => email.replace(/\./g, '[dot]').replace(/\@/g, '[at]');

const renderJson = (s: string, options: { paddingLeft?: number; paddingStartLine?: number } = {}) =>
  JSON.stringify(s, null, 2)
    .split('\n')
    .map((s, index) => {
      const shouldApplyPadding = index >= (options.paddingStartLine || 0);
      const paddingLeftRepeats = shouldApplyPadding ? options.paddingLeft || 0 : 0;
      return `${' '.repeat(paddingLeftRepeats)}${s}`;
    })
    .join('\n');

const includesPersonalData = (it) => it.a.datasets.some((d) => d.privacy.personalDataFields.length);
const collectFilters = (it: any) => uniqBy(it.a.datasets.flatMap((d) => d.filters), m => m); // prettier-ignore
const collectModes = (it: any) => uniqBy(it.a.datasets.flatMap((d) => d.modes), (m: any) => m.name); // prettier-ignore
const collectEmails = (it: any) => uniqBy(it.a.authors.flatMap((a) => a.email), e => e); // prettier-ignore

// TODO
/** Define the texts in features sections that are, by default, common across all actors */
export const defaultFeatureTexts: ApifyReadmeTemplates['features'] = {
  datasets: {
    supported: (it) => it.a.datasets.length > 1,
    title: '<%~ it.a.datasets.length %> kinds of datasets',
    mainText: '- Scrape details of <%~ it.fn.enumerate(it.a.datasets.map((d) => d.name)) %>.',
  },
  modes: {
    supported: (it) => it.fn.collectModes(it).length > 1,
    title: `<%~ it.fn.enumerate(it.fn.collectModes(it).map((m) => it.fn.capitalize(m.name))) %> modes`,
    mainText:
      `- Scraping can be ` +
      `<%~ it.fn.enumerate(it.fn.collectModes(it).map((m) => m.name.toLowerCase() + ' (' + m.shortDesc + ')')) %>` +
      `.`,
  },
  filters: {
    supported: (it) => it.a.datasets.some((d) => d.filters.length),
    data: {
      maxEntriesSupported: true,
    },
    title: 'Filter support',
    mainText:
      `- Filter the results by <%~ it.fn.enumerate(it.fn.collectFilters(it)) %>.\n` +
      `<% if (it.t.features.filters.data.maxEntriesSupported) { %>\n` +
      `  - Limit the number of results.\n` +
      `<% } %>`,
  },
  noBrowser: {
    supported: (it) => it.a.datasets.some((d) => !d.features.usesBrowser),
    title: 'Blazing fast',
    mainText: `- The actor doesn't use a browser, which means it's fast and cheap.`,
  },
  proxy: {
    supported: (it) => it.a.datasets.some((d) => d.features.proxySupport),
    title: 'Proxy support',
    mainText: `- You can use Apify's proxy, or your own, via Input.`,
  },
  integratedETL: {
    supported: (it) => it.a.datasets.some((d) => d.features.integratedETL),
    title: 'Integrated data filtering and transformation',
    mainText: `- Filter and modify scraped entries out of the box from within Apify UI, without needing other tools.`,
  },
  integratedCache: {
    supported: (it) => it.a.datasets.some((d) => d.features.integratedCache),
    title: 'Integrated cache',
    mainText:
      `- You can use cache together with custom filtering to e.g. save only NEW entries to the dataset. Save time and reduce cost.\n` +
      `  - Cache automatically stores which entries were already scraped. Cache can persist between different scraper runs.`,
  },
  crawlerConfig: {
    supported: (it) => it.a.datasets.some((d) => d.features.configurable),
    title: 'Custom crawler configuration',
    mainText: `- For advanced needs, you can pass Crawler configuration via Input.`,
  },
  tests: {
    supported: (it) => it.a.datasets.some((d) => d.features.regularlyTested),
    title: 'Tested daily for high reliability',
    mainText: `- The actor is regularly tested end-to-end to minimize the risk of a broken integration.`,
  },
  privacy: {
    supported: (it) => it.a.datasets.some((d) => d.features.privacyCompliance),
    title: 'Privacy-compliant (GDPR)',
    mainText: `- By default, personal data is redacted to avoid privacy issues. You can opt-in to include un-censored data.`,
  },
  metamorph: {
    supported: () => true,
    title: 'Pass scraped dataset to other actors',
    mainText:
      `- Automatically trigger another actor when this one is done to process the scraped dataset.\n` +
      `  - Metamorphing means that the dataset and key-value store is passed to another actor.\n` +
      `  - Actor metamorph can be configure via actor input. No need to define custom actors just for that.`,
  },
  errorMonitoring: {
    supported: (it) => it.a.datasets.some((d) => d.features.errorMonitoring),
    data: {
      hasSentry: true,
    },
    title: 'Error monitoring',
    mainText:
      `- Errors from your runs are captured and surfaced in the \`REPORTING\` dataset. (See Storage > Dataset > Select dropdown).\n` +
      `<% if (it.t.features.errorMonitoring.data.hasSentry) { %>\n` +
      `  - Errors are also automatically reported to [Sentry](https://sentry.io/).\n` +
      `<% } %>`,
  },
};

const H = README_HOOK_ENUM;

/** The template for rendering README for crawler */
const readmeTemplate = `
<%~ it.a.actor.title %>
===============================

<%~ it.a.actor.shortDesc %>

## What is <%~ it.a.actor.title %> and how it works?

<%~ include("hook.${H.introAfterBegin}", it) %>

With <%~ it.a.actor.title %>, you can extract:

<%- it.a.datasets.forEach((dataset) => { %>
- [<%~ dataset.shortDesc %>]( <%~ dataset.url %> )
<%- }) %>

<%-~ include("hook.${H.introAfterDatasets}", it) %>

See the [outputs section](#outputs) for a detailed description.

The data can be downloaded in JSON, JSONL, XML, CSV, Excel, or HTML formats.

<%~ include("hook.${H.introBeforeEnd}", it) %>

## Features

<%~ include("hook.${H.featuresAfterBegin}", it) %>

This actor is a robust production-grade solution suitable for businesses and those that need reliability.

<%- Object.entries(it.t.features).forEach(([featName, feat]) => { %>
<%- if (feat.supported(it)) { %>
- **<%~ include("feat." + featName + ".title", it) %>**
<% if (feat.afterBegin) { -%>
  <%~ include("feat." + featName + ".afterBegin", it) %>
<%- } -%>
  
  <%-~ include("feat." + featName + ".mainText", it) -%>

<% if (feat.beforeEnd) { -%>
  <%~ include("feat." + featName + ".beforeEnd", it) %>
<%- } -%>
<%- } %>
<%- }) %>

<%~ include("hook.${H.featuresBeforeEnd}", it) %>

## How can you use the data scraped from <%~ it.a.websites[0].name %>? (Examples)

<%~ include("hook.${H.useCases}", it) %>

## How to use <%~ it.a.actor.title %>

<%~ include("hook.${H.usageAfterBegin}", it) %>

1. Create a free Apify account using your email
2. Open <%~ it.a.actor.title %>
3. In Input, select the dataset to scrape, and filters to apply.
4. Click "Start" and wait for the data to be extracted.
5. Download your data in JSON, JSONL, XML, CSV, Excel, or HTML format.

For details and examples for all input fields, please visit the [Input tab](<%~ it.a.actor.publicUrl %>/input-schema).

<%~ include("hook.${H.usageBeforeEnd}", it) %>

## How much does it cost to scrape <%~ it.a.websites[0].name %>?

<%~ include("hook.${H.costAfterBegin}", it) %>

<%- it.a.datasets.filter((d) => d.perfStats && d.perfStats.length).forEach((dataset) => { %>
### <%~ it.fn.capitalize(dataset.name) %>

<table>
  <thead>
    <tr>
      <td></td>
      <%- it.t.perfTables[dataset.perfTable].cols.forEach((col) => { -%>
      <td><strong>
        <%~ include("perfTable." + dataset.perfTable + ".col." + col.colId, { ...it, dataset }) %>
      </strong></td>
      <%- }) -%>
    </tr>
  </thead>

  <tbody>
    <%- it.t.perfTables[dataset.perfTable].rows.forEach((row) => { -%>
    <tr>
      <td>
        <%~ include("perfTable." + dataset.perfTable + ".row." + row.rowId, { ...it, dataset }) %>
      </td>
      <%- it.t.perfTables[dataset.perfTable].cols.forEach((col) => { -%>
      <td>
        <%~ it.fn.perfStat(
          dataset.perfStats.find(d => d.rowId === row.rowId && d.colId === col.colId)
        ) %>
      </td>
      <%- }) -%>
    </tr>
    <%- }) -%>
  </tbody>
</table>

<%- }) %>

<br/>

<%~ include("hook.${H.costAfterPerfTables}", it) %>

Remember that with the [Apify Free plan](https://apify.com/pricing), you have $5 free usage per month.

<%~ include("hook.${H.costBeforeEnd}", it) %>

## Input options

<%~ include("hook.${H.inputAfterBegin}", it) %>

For details and examples for all input fields, please visit the [Input tab](<%~ it.a.actor.publicUrl %>/input-schema).

<%~ include("hook.${H.inputBeforeEnd}", it) %>

### Filter options

<%~ include("hook.${H.filterAfterBegin}", it) %>

You can run <%~ it.a.actor.title %> as is, with the default options, to get a sample of the 
<%~ it.a.datasets.find(d => d.isDefault).name %> entries
<%_ if (it.fn.collectModes(it).find(m => m.isDefault)) { _%>
<%_~ ' (' + it.fn.collectModes(it).find(m => m.isDefault).name %> mode)
<%_ } _%>.

<%- if (it.fn.collectFilters(it).length) { %>
Otherwise, you can filter by:

<%- it.fn.collectFilters(it).forEach((filter) => { %>
  - <%~ it.fn.capitalize(filter) %>
<%- }) %>
<%- } %>

<%~ include("hook.${H.filterBeforeEnd}", it) %>

### Limit options

<%~ include("hook.${H.limitAfterBegin}", it) %>

To limit how many results you get, set \`<%~ it.t.input.maxCount %>\` to desired amount.

<%~ include("hook.${H.limitBeforeEnd}", it) %>

### Input examples

<%~ include("hook.${H.inputExampleAfterBegin}", it) %>

<% it.t.exampleInputs.forEach((example, index) => { %>
#### Example <%~ index + 1 %>: <%~ example.title %>

\`\`\`json
{
<%- Object.entries(example.inputData).forEach(([key, value]) => { -%>
<%- if (example.inputDataComments && example.inputDataComments[key]) { %>
  // <%~ example.inputDataComments[key] %>
<%- } %>
  "<%~ key %>": <% _%><%~ it.fn.stringify(value, { paddingLeft: 2, paddingStartLine: 1 }) %>,
<%- }) %>
}
\`\`\`

<% }) %>

<%~ include("hook.${H.inputExampleBeforeEnd}", it) %>

## Outputs

<%~ include("hook.${H.outputAfterBegin}", it) %>

Once the actor is done, you can see the overview of results in the Output tab.

To export the data, head over to the Storage tab.

![<%~ it.a.actor.title %> dataset overview](<%~ it.a.actor.datasetOverviewImgUrl %>)

<%~ include("hook.${H.outputBeforeEnd}", it) %>

## Sample output from <%~ it.a.actor.title %>

<%~ include("hook.${H.outputExampleAfterBegin}", it) %>

<%- it.a.datasets.forEach((dataset) => { %>
### <%~ it.fn.capitalize(dataset.name) %> output

\`\`\`json
{
<%- Object.entries(dataset.output.exampleEntry).forEach(([key, value]) => { -%>
<%- if (dataset.output.exampleEntryComments && dataset.output.exampleEntryComments[key]) { %>
  // <%~ dataset.output.exampleEntryComments[key] %>
<%- } %>
  "<%~ key %>": <% _%><%~ it.fn.stringify(value, { paddingLeft: 2, paddingStartLine: 1 }) %>,
<%- }) %>
}
\`\`\`

<%- }) %>

<%~ include("hook.${H.outputExampleBeforeEnd}", it) %>

## How to integrate <%~ it.a.actor.title %> with other services, APIs or Actors

<%~ include("hook.${H.integrationAfterBegin}", it) %>

You can connect the actor with many of the
[integrations on the Apify platform](https://apify.com/integrations).
You can integrate with Make, Zapier, Slack, Airbyte, GitHub, Google Sheets, Google Drive,
[and more](https://docs.apify.com/integrations).
Or you can use
[webhooks](https://docs.apify.com/integrations/webhooks)
to carry out an action whenever an event occurs, e.g. get a notification whenever
Instagram API Scraper successfully finishes a run.

<%~ include("hook.${H.integrationBeforeEnd}", it) %>

## Use <%~ it.a.actor.title %> with Apify API

<%~ include("hook.${H.apifyAfterBegin}", it) %>

The Apify API gives you programmatic access to the Apify platform.
The API is organized around RESTful HTTP endpoints that enable you to manage,
schedule and run Apify actors. The API also lets you access any datasets,
monitor actor performance, fetch results, create and update versions, and more.

To access the API using Node.js, use the \`apify-client\` NPM package.
To access the API using Python, use the \`apify-client\` PyPI package.

Check out the [Apify API reference](https://docs.apify.com/api/v2) docs
for full details or click on the
[API tab](<%~ it.a.actor.publicUrl %>/api)
for code examples.

<%~ include("hook.${H.apifyBeforeEnd}", it) %>

## Is it legal to scrape <%~ it.a.websites[0].name %>?

<%~ include("hook.${H.legalityAfterBegin}", it) %>

It is legal to scrape publicly available data such as product descriptions,
prices, or ratings. Read Apify's blog post on
[the legality of web scraping](https://blog.apify.com/is-web-scraping-legal/)
to learn more.

<%- if (it.fn.includesPersonalData(it)) { %>
However, the following datasets include personal data:

<%- it.a.datasets.filter((d) => d.privacy.personalDataFields.length).forEach((dataset) => { %>
- <%~ it.fn.capitalize(dataset.name) %> dataset includes info about <%~ it.fn.enumerate(dataset.privacy.personalDataSubjects) %>.
  - Fields: <%~ dataset.privacy.personalDataFields.join(', ') %>
<% if (dataset.privacy.isPersonalDataRedacted) { -%>
  - By default, this personal data is redacted, and in such case, it's safe to scrape the data.
<%- } %>
<%- }) %>

To get the unredacted data, toggle on the "<%~ it.t.input.privacyName %>" actor input.

> **Warning:** Including personal data is done at your own risk. It is your
responsibility to make sure you have obtained consent or have a legal basis
for using the data.
>
> By using this actor, you agree not to hold the author of this actor liable for privacy
or data-related issues that may arise during its use.

Redacted fields may show a message like this instead of the actual value:

\`\`\`txt
<Redacted property "email". To include the actual value, toggle ON the Actor input option "<%~ it.t.input.privacyName %>">
\`\`\`

<%- } %>

<%~ include("hook.${H.legalityBeforeEnd}", it) %>

## Who can I contact for issues with <%~ it.a.websites[0].name %> actor?

<%~ include("hook.${H.contactAfterBegin}", it) %>

To report issues and find help,
<%- if (it.a.platform.socials.discord) { %>
head over to the
[Discord community](<%~ it.a.platform.socials.discord %>)
<%- } %>
<%_ if (it.a.platform.socials.discord && it.fn.collectEmails(it).length) { %>, or <% } _%>
email me at <%~ it.fn.email(it.fn.collectEmails(it)[0]) %>

<%~ include("hook.${H.contactBeforeEnd}", it) %>
`;

/**
 * Render a README.md file from a common template for a given Apify crawler.
 *
 * See https://docs.apify.com/academy/get-most-of-actors/actor-readme
 *
 * The templates are rendered using ETA (https://eta.js.org/)
 *
 * Each template has access to `it` global variable. `it` has these props:
 *
 * - `it.fn` - The functions passed to this function + more (see below)
 * - `it.t` - The templates object passed to this function
 * - `it.a` - The actorSpec object passed to this function
 *
 * Example:
 * ```eta
 * ActorId: <%~ it.a.platform.actorId %>
 * ```
 *
 * Following functions are available by default:
 * - `it.fn.enumerate`
 * - `it.fn.perfStat`
 * - `it.fn.millify`
 * - `it.fn.capitalize`
 * - `it.fn.stringify`
 * - `it.fn.email`
 * - `it.fn.includesPersonalData`
 * - `it.fn.collectFilters`
 * - `it.fn.collectModes`
 * - `it.fn.collectEmails`
 *
 * See their definitions for details
 */
export const renderApifyReadme = async (input: {
  /** Filepath (relative to CWD) where the generated README should be written. */
  filepath: string;
  /**
   * Info about a particular actor.
   *
   * Inside the template during rendering, this object
   * can be accessed as `<%~ it.a.platform.actorId %>`
   */
  actorSpec: ApifyScraperActorSpec;
  /**
   * Custom eta template strings that plug into different
   * parts of the README template.
   *
   * Inside the template during rendering, these templates
   * can be accessed as `<%~ it.t.someTemplate %>`
   */
  templates: ApifyReadmeTemplatesOverrides;
  /**
   * Functions to be made available in the template.
   *
   * Inside the template during rendering, these functions
   * can be accessed as `<%~ it.fn.funcName() %>`
   */
  fn?: Record<string, (...args: any[]) => any>;
}) => {
  // Assign the default values to a clone
  const templates = cloneDeep(input.templates) as ApifyReadmeTemplates;
  templates.features = templates.features || {};
  Object.entries(defaultFeatureTexts).forEach(([key, feat]) => {
    templates.features[key] = defaults(templates.features[key] || {}, feat);
  });

  // Define templates for 'include(...)'s for template hooks
  README_HOOK.forEach((key) => {
    const template = templates.hooks?.[key];
    eta.templatesSync.define(`hook.${key}`, eta.compile(template || ''));
  });
  // Define templates for 'include(...)'s for feature hooks
  Object.entries(templates.features).forEach(([key, feat]) => {
    const { title, mainText, afterBegin, beforeEnd } = feat;
    eta.templatesSync.define(`feat.${key}.title`, eta.compile(title));
    eta.templatesSync.define(`feat.${key}.mainText`, eta.compile(mainText));
    eta.templatesSync.define(`feat.${key}.afterBegin`, eta.compile(afterBegin ?? ''));
    eta.templatesSync.define(`feat.${key}.beforeEnd`, eta.compile(beforeEnd ?? ''));
  });
  // Define templates for 'include(...)'s for perf table hooks
  Object.entries(templates.perfTables || {}).forEach(([key, perfTable]) => {
    perfTable.rows.forEach((row) => eta.templatesSync.define(`perfTable.${key}.row.${row.rowId}`, eta.compile(row.template))); // prettier-ignore
    perfTable.cols.forEach((col) => eta.templatesSync.define(`perfTable.${key}.col.${col.colId}`, eta.compile(col.template))); // prettier-ignore
  });

  const fn = {
    enumerate: renderList,
    perfStat: renderPerfStat,
    millify,
    capitalize,
    stringify: renderJson,
    email: renderEmail,
    includesPersonalData,
    collectFilters,
    collectModes,
    collectEmails,
    ...input.fn,
  };

  const data = { fn, t: templates, a: input.actorSpec } satisfies RenderContext;
  const readmeContent = eta.render(readmeTemplate, data);

  const readmePath = path.resolve(process.cwd(), input.filepath);
  await fsp.mkdir(path.dirname(readmePath), { recursive: true });
  await fsp.writeFile(readmePath, readmeContent, 'utf-8');
};
