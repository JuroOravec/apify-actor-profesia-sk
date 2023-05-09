import Joi from 'joi';
import {
  crawlerInputValidationFields,
  loggingInputValidationFields,
  outputInputValidationFields,
  privacyInputValidationFields,
  proxyInputValidationFields,
} from 'apify-actor-utils';

import { DATASET_TYPE, EMPLOYMENT_TYPE, SALARY_PERIOD, WORK_FROM_HOME_TYPE } from './types';
import type { ActorInput } from './config';
import { datasetTypeToUrl } from './constants';

const inputValidationSchema = Joi.object<ActorInput>({
  ...crawlerInputValidationFields,
  ...proxyInputValidationFields,
  ...loggingInputValidationFields,
  ...outputInputValidationFields,
  ...privacyInputValidationFields,

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
} satisfies Record<keyof ActorInput, Joi.Schema>);

export const validateInput = (input: ActorInput | null) => {
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
