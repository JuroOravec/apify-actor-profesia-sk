import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runActorTest } from 'apify-actor-utils';

import {
  detailedJobOfferValidation,
  joiEmploymentType,
  joiStrNotEmptyNullable,
} from '../utils/assert';
import { run } from '../../src/actor';
import { ROUTE_LABEL_ENUM } from '../../src/types';

const log = (...args) => console.log(...args);
const runActor = () => run({ useSessionPool: false, maxRequestRetries: 0 });

const customJobOfferValidation = detailedJobOfferValidation.keys({
  employmentTypes: Joi.array().items(joiEmploymentType),
  startDate: joiStrNotEmptyNullable,
});

const jobDetailStandardUrls = [
  'https://www.profesia.sk/praca/komix-sk/O4556386',
  'https://www.profesia.sk/praca/dekra-kvalifikacia-a-poradenstvo/O4560786',
  'https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250',
];

const jobDetailCustomUrls = [
  'https://www.profesia.sk/praca/accenture/O4491399',
  'https://www.profesia.sk/praca/gohealth/O3964543',
];

describe(
  ROUTE_LABEL_ENUM.JOB_DETAIL,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it(`extracts job offer details from standard page`, () => {
      expect.assertions(jobDetailStandardUrls.length);
      let calls = 0;
      return runActorTest({
        vi,
        input: { startUrls: jobDetailStandardUrls },
        runActor,
        onPushData: async (data, done) => {
          calls += 1;
          expect(data.length).toBeGreaterThan(0);
          data.forEach((d) => Joi.assert(d, detailedJobOfferValidation));
          if (calls >= jobDetailStandardUrls.length) done();
        },
      });
    });

    it(`extracts some job offer details from custom page`, () => {
      expect.assertions(jobDetailCustomUrls.length);
      let calls = 0;
      return runActorTest({
        vi,
        input: { startUrls: jobDetailCustomUrls },
        runActor,
        onPushData: async (data, done) => {
          calls += 1;
          expect(data.length).toBeGreaterThan(0);
          data.forEach((d) => Joi.assert(d, customJobOfferValidation));
          if (calls >= jobDetailCustomUrls.length) done();
        },
      });
    });
  },
  { timeout: 20_000 }
);
