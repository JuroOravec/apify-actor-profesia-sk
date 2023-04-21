import Joi from 'joi';

import {
  DATASET_TYPE,
  DefaultActorInput,
  EMPLOYMENT_TYPE,
  ProfesiaSkActorInput,
  SALARY_PERIOD,
  WORK_FROM_HOME_TYPE,
} from './types';
import { datasetTypeToUrl } from './constants';

const defaultInputValidationFields: Record<keyof DefaultActorInput, Joi.Schema> = {
  proxy: Joi.object().optional(), // TODO Expand this type?
  navigationTimeoutSecs: Joi.number().integer().min(0).optional(),
  ignoreSslErrors: Joi.boolean().optional(),
  additionalMimeTypes: Joi.array().items(Joi.string().min(1)).optional(),
  suggestResponseEncoding: Joi.string().min(1).optional(),
  forceResponseEncoding: Joi.string().min(1).optional(),
  requestHandlerTimeoutSecs: Joi.number().integer().min(0).optional(),
  maxRequestRetries: Joi.number().integer().min(0).optional(),
  maxRequestsPerCrawl: Joi.number().integer().min(0).optional(),
  maxRequestsPerMinute: Joi.number().integer().min(0).optional(),
  minConcurrency: Joi.number().integer().min(0).optional(),
  maxConcurrency: Joi.number().integer().min(0).optional(),
  keepAlive: Joi.boolean().optional(),
};

const inputValidationSchema = Joi.object<ProfesiaSkActorInput>({
  ...defaultInputValidationFields,
  datasetType: Joi.string().valid(...DATASET_TYPE).optional(), // prettier-ignore
  startUrls: Joi.array().optional(),
  jobOfferDetailed: Joi.boolean().optional(),
  jobOfferFilterQuery: Joi.string().optional(),
  jobOfferFilterMaxCount: Joi.number().min(0).integer().optional(),
  jobOfferFilterMinSalaryValue: Joi.number().min(0).integer().optional(),
  jobOfferFilterMinSalaryPeriod: Joi.string().valid(...SALARY_PERIOD).optional(), // prettier-ignore
  jobOfferFilterEmploymentType: Joi.string().valid(...EMPLOYMENT_TYPE).optional(), // prettier-ignore
  jobOfferFilterRemoteWorkType: Joi.string().valid(...WORK_FROM_HOME_TYPE).optional(), // prettier-ignore
  jobOfferFilterLastNDays: Joi.number().min(0).integer().optional(),
  jobOfferCountOnly: Joi.boolean().optional(),
});

export const validateInput = (input: ProfesiaSkActorInput | null) => {
  Joi.assert(input, inputValidationSchema);

  if (!input?.startUrls && !input?.datasetType) {
    throw Error(
      `Missing instruction for scraping - either startUrls or datasetType MUST be specified. INPUT: ${JSON.stringify(
        input
      )}`
    );
  }

  if (input.startUrls && input.datasetType) {
    throw Error(
      `Ambiguous instruction for scraping - only ONE of startUrls or datasetType MUST be specified. INPUT: ${JSON.stringify(
        input
      )}`
    );
  }

  if (!input.startUrls && !datasetTypeToUrl[input.datasetType!]) {
    throw Error(`Invalid value for datasetType option. Got ${input.datasetType}, but allowed values are ${JSON.stringify(Object.keys(datasetTypeToUrl))} `); // prettier-ignore
  }
};
