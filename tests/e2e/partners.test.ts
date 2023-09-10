import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runCrawlerTest } from 'crawlee-one';

import { partnerEntryValidation } from '../utils/assert';
import { run } from '../../src/actor';
import type { ActorInput } from '../../src/config';
import { profesiaLabelEnum } from '../../src/__generated__/crawler';

const log = (...args) => console.log(...args);
const runCrawler = () => run({ useSessionPool: false, maxRequestRetries: 0 });

describe(
  profesiaLabelEnum.partners,
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

    it('extracts partners data', async () => {
      return runCrawlerTest<any, ActorInput>({
        vi,
        input: { startUrls: ['https://profesia.sk/partneri'], includePersonalData: true },
        runCrawler,
        onPushData: (data, done) => {
          expect(data.length).toBeGreaterThan(0);

          data.forEach((d) => Joi.assert(d, partnerEntryValidation));
          done();
        },
      });
    });
  },
  { timeout: 20_000 }
);
