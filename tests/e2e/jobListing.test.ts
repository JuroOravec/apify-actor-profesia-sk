import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runActorTest } from 'apify-actor-utils';

import {
  simpleJobOfferValidation,
  detailedJobOfferValidation,
  joiEmploymentType,
  joiStrNotEmptyNullable,
} from '../utils/assert';
import { ROUTE_LABEL_ENUM, SimpleProfesiaSKJobOfferItem } from '../../src/types';
import { sortUrl } from '../../src/utils/url';
import { run } from '../../src/actor';

const log = (...args) => console.log(...args);
const runActor = () => run({ useSessionPool: false, maxRequestRetries: 0 });

// prettier-ignore
const jobListings = [
  { name: 'main page (redirect to job offers)', url: 'https://www.profesia.sk', numOfAssertCalls: 2 },
  { name: 'main job offers listing', url: 'https://www.profesia.sk/praca', numOfAssertCalls: 2  },
  { name: 'listing with specific filters', url: 'https://www.profesia.sk/praca/bratislavsky-kraj/?count_days=21&remote_work=1&salary=500&salary_period=m&search_anywhere=tech', numOfAssertCalls: 2  },
  { name: 'company listing', url: 'https://www.profesia.sk/praca/123kurier/C238652', numOfAssertCalls: 1  },
  { name: 'position listing', url: 'https://www.profesia.sk/praca/account-executive/', numOfAssertCalls: 1  },
  { name: 'language listing', url: 'https://www.profesia.sk/praca/anglicky-jazyk/', numOfAssertCalls: 2  },
  { name: 'location listing', url: 'https://www.profesia.sk/praca/okres-pezinok/', numOfAssertCalls: 2  },
];

const customJobOfferValidation = detailedJobOfferValidation.keys({
  employmentTypes: Joi.array().items(joiEmploymentType),
  startDate: joiStrNotEmptyNullable,
});

describe(
  ROUTE_LABEL_ENUM.JOB_LISTING,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    jobListings.forEach(({ name, url, numOfAssertCalls }) => {
      it(`extracts job offers from "${name}"`, () => {
        expect.assertions(numOfAssertCalls);
        let calls = 0;
        return runActorTest({
          vi,
          input: { startUrls: [url], jobOfferFilterMaxCount: 21 },
          runActor,
          onPushData: async (data, done) => {
            calls += 1;
            expect(data.length).toBeGreaterThan(0);
            data.forEach((d) => Joi.assert(d, simpleJobOfferValidation));
            if (calls >= numOfAssertCalls) done();
          },
        });
      });
    });

    it('configures listing filters based on actor input', () => {
      expect.assertions(2);
      return runActorTest({
        vi,
        input: {
          startUrls: ['https://www.profesia.sk/praca'],
          jobOfferFilterQuery: 'asis',
          jobOfferFilterMaxCount: 21,
          jobOfferFilterMinSalaryValue: 6,
          jobOfferFilterMinSalaryPeriod: 'hour',
          jobOfferFilterEmploymentType: 'fte',
          jobOfferFilterRemoteWorkType: 'partialRemote',
          jobOfferFilterLastNDays: 70,
        },
        runActor,
        onPushData: async (data: SimpleProfesiaSKJobOfferItem[], done) => {
          expect(data.length).toBeGreaterThan(0);
          data.forEach((d) => Joi.assert(d, simpleJobOfferValidation));
          expect(sortUrl(data[0].listingUrl)).toBe(sortUrl('https://www.profesia.sk/praca/?count_days=70&remote_work=2&salary=6&salary_period=h&search_anywhere=asis')); // prettier-ignore
          done();
        },
      });
    });

    it('Only prints the count if jobOfferCountOnly=true', () => {
      expect.assertions(2);
      return runActorTest({
        vi,
        input: {
          startUrls: ['https://www.profesia.sk/praca'],
          jobOfferCountOnly: true,
        },
        runActor,
        onPushData: async (data: SimpleProfesiaSKJobOfferItem[]) => {
          throw Error('No data should be returned on jobOfferCountOnly=true');
        },
        onBatchAddRequests: (requests) => {
          expect(requests).toHaveLength(1);
          expect(requests[0].url).toBe('https://www.profesia.sk/praca');
        },
        onDone: (done) => {
          done();
        },
      });
    });

    it('Does not enqueue job offer details URLs if jobOfferDetailed=false', () => {
      expect.assertions(3);
      return runActorTest({
        vi,
        input: {
          startUrls: ['https://www.profesia.sk/praca'],
          jobOfferFilterMaxCount: 3,
        },
        runActor,
        onPushData: async (data: SimpleProfesiaSKJobOfferItem[]) => {
          expect(data.length).toBeGreaterThan(0);
          data.forEach((d) => Joi.assert(d, simpleJobOfferValidation));
        },
        onBatchAddRequests: (requests) => {
          expect(requests).toHaveLength(1);
          expect(requests[0].url).toBe('https://www.profesia.sk/praca');
        },
        onDone: (done) => {
          done();
        },
      });
    });

    it('Enqueues job offer details URLs if jobOfferDetailed=true', () => {
      expect.assertions(4);
      return runActorTest({
        vi,
        input: {
          startUrls: ['https://www.profesia.sk/praca'],
          jobOfferDetailed: true,
          jobOfferFilterMaxCount: 3,
        },
        runActor,
        onPushData: async (data: SimpleProfesiaSKJobOfferItem[]) => {
          expect(data.length).toBeGreaterThan(0);
          data.forEach((d) => Joi.assert(d, customJobOfferValidation));
          expect(data[0].offerUrl).not.toBe('https://www.profesia.sk/praca');
        },
        onBatchAddRequests: (requests) => {
          expect(requests).toHaveLength(1);
          expect(requests[0].url).toBe('https://www.profesia.sk/praca');
        },
        onDone: (done) => {
          done();
        },
      });
    });
  },
  { timeout: 20_000 }
);
