import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';

import { runActorTest } from '../setup/apify';
import {
  genericEntryValidation,
  locationEntryValidation,
  partnerEntryValidation,
  simpleJobOfferValidation,
} from '../utils/assert';
import { datasetTypeToUrl } from '../../src/constants';
import type { DatasetType } from '../../src/types';

const log = (...args) => console.log(...args);

// prettier-ignore
const testCases: { datasetType: DatasetType; expectedUrl: string; schema: Joi.ObjectSchema; numOfPushDataCalls: number; numOfAssertCalls: number }[] = [
  { datasetType: 'companies', expectedUrl: datasetTypeToUrl.companies, schema: genericEntryValidation, numOfPushDataCalls: 2, numOfAssertCalls: 2 },
  { datasetType: 'industries', expectedUrl: datasetTypeToUrl.industries, schema: genericEntryValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
  { datasetType: 'positions', expectedUrl: datasetTypeToUrl.positions, schema: genericEntryValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
  { datasetType: 'languages', expectedUrl: datasetTypeToUrl.languages, schema: genericEntryValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
  { datasetType: 'locations', expectedUrl: datasetTypeToUrl.locations, schema: locationEntryValidation, numOfPushDataCalls: 2, numOfAssertCalls: 2 },
  { datasetType: 'partners', expectedUrl: datasetTypeToUrl.partners, schema: partnerEntryValidation, numOfPushDataCalls: 2, numOfAssertCalls: 2 },
  { datasetType: 'jobOffers', expectedUrl: datasetTypeToUrl.jobOffers, schema: simpleJobOfferValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
];

describe(
  'general',
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    testCases.forEach(
      ({ datasetType, expectedUrl, schema, numOfPushDataCalls, numOfAssertCalls }) => {
        it(`extracts ${datasetType} when datasetType=${datasetType}`, () => {
          expect.assertions(numOfAssertCalls);
          let calls = 0;
          return runActorTest({
            input: {
              datasetType: datasetType as DatasetType,
              jobOfferFilterMaxCount: 3,
              jobOfferDetailed: false,
            },
            onBatchAddRequests: (req) => {
              expect(expectedUrl).toBe(req[0].url);
            },
            onPushData: async (data, done) => {
              calls += 1;
              expect(data.length).toBeGreaterThan(0);
              data.forEach((d) => Joi.assert(d, schema));
              if (calls >= numOfPushDataCalls) done();
            },
          });
        });
      }
    );
  },
  { timeout: 20_000 }
);