import { startCase } from 'lodash';
import {
  createActorConfig,
  createActorInputSchema,
  createBooleanField,
  createIntegerField,
  createStringField,
  Field,
  ActorInputSchema,
  createActorOutputSchema,
} from 'apify-actor-config';
import { AllActorInputs, allActorInputs } from 'crawlee-one';

import { DATASET_TYPE, DatasetType, EmploymentType, SalaryPeriod, WorkFromHomeType } from './types';
import actorSpec from './actorspec';
import { SALARY_PERIOD } from './types';
import { EMPLOYMENT_TYPE } from './types';
import { WORK_FROM_HOME_TYPE } from './types';

const createTagFn = (tag: string) => (t: string) => `<${tag}>${t}</${tag}>`;
const strong = createTagFn('strong');
const newLine = (repeats = 1) => '<br/>'.repeat(repeats);

export interface CustomActorInput {
  /** Choose what kind of data you want to extract - job offers, list of companies, list of industries, ... */
  datasetType?: DatasetType;
  /** If checked, the scraper will obtain more detailed info for job offers by visit the details page of each job offer to extract data. If un-checked, only the data from the listing page is extracted. For details, please refer to http://apify.com/store/jurooravec/profesia-sk-scraper#output */
  jobOfferDetailed?: boolean;
  /** Comma-separated list of keywords. If given, only entries matching the query will be retrieved (full-text search) */
  jobOfferFilterQuery?: string;
  /** If set, only entries offering this much or more will be extracted */
  jobOfferFilterMinSalaryValue?: number;
  /** Choose if the minimum salary is in per hour or per month format */
  jobOfferFilterMinSalaryPeriod?: SalaryPeriod;
  /** If set, only entries with this employment filter will be extracted */
  jobOfferFilterEmploymentType?: EmploymentType;
  /** If set, only entries with this type of remote work filter will be extracted */
  jobOfferFilterRemoteWorkType?: WorkFromHomeType;
  /** If set, only entries this much days old will be extracted. E.g. 7 = 1 week old, 31 = 1 month old, ... */
  jobOfferFilterLastNDays?: number;
  /** If checked, no data is extracted. Instead, the count of matched job offers is printed in the log. */
  jobOfferCountOnly?: boolean;
}

/** Shape of the data passed to the actor from Apify */
export interface ActorInput
  // Include the common fields in input
  extends AllActorInputs,
    CustomActorInput {}

const customActorInput: Record<keyof CustomActorInput, Field> = {
  datasetType: createStringField<DatasetType>({
    type: 'string',
    title: 'Dataset type',
    description: `Use this option if you want to scrape a whole dataset,
        not just specific URLs.${newLine(2)}
        This option is ignored if ${strong('Start URLs:')} are given`,
    editor: 'select',
    example: 'jobOffers',
    default: 'jobOffers',
    prefill: 'jobOffers',
    enum: DATASET_TYPE,
    enumTitles: DATASET_TYPE.map(startCase),
    nullable: true,
  }),

  jobOfferDetailed: createBooleanField({
    title: 'Detailed',
    type: 'boolean',
    description: `If checked, the scraper will obtain more detailed info
      for job offers by visit the details page of each job offer.${newLine(2)}
      If un-checked, only the data from the listing page is extracted.${newLine(2)}
      For details, please refer to ${actorSpec.actor.publicUrl}#output`,
    example: true,
    default: true,
    sectionCaption: 'Job Offer Filters',
    sectionDescription: `These filters are applied ${strong('ONLY')} when scraping job offers`,
    nullable: true,
  }),
  jobOfferFilterQuery: createStringField({
    type: 'string',
    title: 'Search keywords (full-text search)',
    description: `Comma-separated list of keywords. If given, only entries
      matching the keywords will be retrieved (full-text search)`,
    example: 'specialist, Bratislava',
    editor: 'textfield',
    nullable: true,
  }),
  jobOfferFilterMinSalaryValue: createIntegerField({
    title: 'Min salary',
    type: 'integer',
    description: 'If set, only entries offering this much or more will be extracted',
    example: 1000,
    minimum: 1,
    nullable: true,
  }),
  jobOfferFilterMinSalaryPeriod: createStringField<SalaryPeriod>({
    title: 'Min salary per hour/month',
    type: 'string',
    description: 'Choose if the minimum salary is in per hour or per month format',
    editor: 'select',
    example: 'month',
    default: 'month',
    prefill: 'month',
    enum: SALARY_PERIOD,
    enumTitles: SALARY_PERIOD.map((s) => `Per ${s}`),
    nullable: true,
  }),
  jobOfferFilterEmploymentType: createStringField<EmploymentType>({
    title: 'Type of employment',
    type: 'string',
    description: 'If set, only entries with this employment filter will be extracted',
    editor: 'select',
    example: 'fte',
    enum: EMPLOYMENT_TYPE,
    enumTitles: EMPLOYMENT_TYPE.map(startCase),
    nullable: true,
  }),
  jobOfferFilterRemoteWorkType: createStringField<WorkFromHomeType>({
    title: 'Remote vs On-site',
    type: 'string',
    description: 'If set, only entries with this type of remote work filter will be extracted',
    editor: 'select',
    example: 'fullRemote',
    enum: WORK_FROM_HOME_TYPE,
    enumTitles: WORK_FROM_HOME_TYPE.map(startCase),
    nullable: true,
  }),
  jobOfferFilterLastNDays: createIntegerField({
    title: 'Last N days',
    type: 'integer',
    description: `If set, only entries up to this much days old will be extracted.
    E.g. 7 = max 1 week old, 31 = max 1 month old, ...`,
    example: 10,
    minimum: 0,
    nullable: true,
  }),
  jobOfferCountOnly: createBooleanField({
    title: 'Count the matched job offers',
    type: 'boolean',
    description: `If checked, no data is extracted. Instead, the count of matched
    job offers is printed in the log.`,
    default: false,
    groupCaption: 'Troubleshooting options',
    groupDescription: 'Use these to verify that your custom startUrls are correct',
    nullable: true,
  }),
};

// Customize the default options
allActorInputs.requestHandlerTimeoutSecs.prefill = 60 * 3;

const inputSchema = createActorInputSchema<ActorInputSchema<Record<keyof ActorInput, Field>>>({
  schemaVersion: 1,
  title: actorSpec.actor.title,
  description: `Configure the ${actorSpec.actor.title}. ${newLine(2)}
      ${strong('NOTE:')} Either ${strong('Dataset type')} or
      ${strong('Start URLs')} must be given.`,
  type: 'object',
  properties: {
    ...customActorInput,
    // Include the common fields in input
    ...allActorInputs,
  },
});

const outputSchema = createActorOutputSchema({
  actorSpecification: 1,
  fields: {},
  views: {},
});

const config = createActorConfig({
  actorSpecification: 1,
  name: actorSpec.platform.actorId,
  title: actorSpec.actor.title,
  description: actorSpec.actor.shortDesc,
  version: '1.0',
  dockerfile: './Dockerfile',
  input: inputSchema,
  storages: {
    dataset: outputSchema,
  },
});

export default config;
