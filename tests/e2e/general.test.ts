import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runCrawlerTest } from 'crawlee-one';

import {
  genericEntryValidation,
  locationEntryValidation,
  partnerEntryValidation,
  simpleJobOfferValidation,
} from '../utils/assert';
import { datasetTypeToUrl } from '../../src/constants';
import type { DatasetType } from '../../src/types';
import { run } from '../../src/actor';
import type { ActorInput } from '../../src/config';

const log = (...args) => console.log(...args);
const runCrawler = () => run({ useSessionPool: false, maxRequestRetries: 0 });

// prettier-ignore
const testCases: { datasetType: DatasetType; expectedUrl: string; schema: Joi.ObjectSchema; numOfPushDataCalls: number; numOfAssertCalls: number }[] = [
  { datasetType: 'companies', expectedUrl: datasetTypeToUrl.companies, schema: genericEntryValidation, numOfPushDataCalls: 2, numOfAssertCalls: 3 },
  { datasetType: 'industries', expectedUrl: datasetTypeToUrl.industries, schema: genericEntryValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
  { datasetType: 'professions', expectedUrl: datasetTypeToUrl.professions, schema: genericEntryValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
  { datasetType: 'languages', expectedUrl: datasetTypeToUrl.languages, schema: genericEntryValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
  { datasetType: 'locations', expectedUrl: datasetTypeToUrl.locations, schema: locationEntryValidation, numOfPushDataCalls: 2, numOfAssertCalls: 3 },
  { datasetType: 'partners', expectedUrl: datasetTypeToUrl.partners, schema: partnerEntryValidation, numOfPushDataCalls: 2, numOfAssertCalls: 2 },
  { datasetType: 'jobOffers', expectedUrl: datasetTypeToUrl.jobOffers, schema: simpleJobOfferValidation, numOfPushDataCalls: 1, numOfAssertCalls: 2 },
];

describe(
  'general',
  () => {
    beforeEach(() => {
      vi.resetAllMocks();

      vi.mock('pkginfo', () => ({
        default: (obj, { include }) => {
          obj.exports = obj.exports || {};
          obj.exports.name = 'test_package_name';
        },
      }));
    });

    testCases.forEach(
      ({ datasetType, expectedUrl, schema, numOfPushDataCalls, numOfAssertCalls }) => {
        it(`extracts ${datasetType} when datasetType=${datasetType}`, () => {
          expect.assertions(numOfAssertCalls);
          let calls = 0;
          return runCrawlerTest<any, ActorInput>({
            vi,
            input: {
              datasetType: datasetType as DatasetType,
              outputMaxEntries: 3,
              jobOfferDetailed: false,
              includePersonalData: true,
            },
            runCrawler,
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
