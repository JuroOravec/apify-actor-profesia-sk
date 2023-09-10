import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runCrawlerTest } from 'crawlee-one';

import {
  detailedJobOfferValidation,
  joiEmploymentType,
  joiStrNotEmptyNullable,
} from '../utils/assert';
import { run } from '../../src/actor';
import type { ActorInput } from '../../src/config';
import { profesiaLabelEnum } from '../../src/__generated__/crawler';

const runCrawler = () => run({ useSessionPool: false, maxRequestRetries: 0 });

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
  profesiaLabelEnum.jobDetail,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();

      vi.mock('pkginfo', () => ({
        default: (obj) => {
          obj.exports = obj.exports || {};
          obj.exports.name = 'test_package_name';
        },
      }));
    });

    it(
      `extracts job offer details from standard page`,
      () => {
        expect.assertions(jobDetailStandardUrls.length);
        let calls = 0;
        return runCrawlerTest<any, ActorInput>({
          vi,
          input: { startUrls: jobDetailStandardUrls, includePersonalData: true },
          runCrawler,
          onPushData: async (data, done) => {
            calls += 1;
            expect(data.length).toBeGreaterThan(0);
            data.forEach((d) => Joi.assert(d, detailedJobOfferValidation));
            if (calls >= jobDetailStandardUrls.length) done();
          },
        });
      },
      { timeout: 10_000 }
    );

    it(`extracts some job offer details from custom page`, () => {
      expect.assertions(jobDetailCustomUrls.length);
      let calls = 0;
      return runCrawlerTest<any, ActorInput>({
        vi,
        input: { startUrls: jobDetailCustomUrls, includePersonalData: true },
        runCrawler,
        onPushData: async (data, done) => {
          calls += 1;
          expect(data.length).toBeGreaterThan(0);
          data.forEach((d) => Joi.assert(d, customJobOfferValidation));
          if (calls >= jobDetailCustomUrls.length) done();
        },
      });
    });
  },
  { timeout: 5_000 }
);
