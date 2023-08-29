import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runCrawlerTest } from 'crawlee-one';

import { genericEntryValidation, locationEntryValidation } from '../utils/assert';
import { run } from '../../src/actor';
import { ROUTE_LABEL_ENUM } from '../../src/types';
import type { ActorInput } from '../../src/config';

const log = (...args) => console.log(...args);
const runCrawler = () => run({ useSessionPool: false, maxRequestRetries: 0 });

// prettier-ignore
const jobRelatedLists = [
  { name: 'industries', url: 'https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/', numOfAssertCalls: 1, schema: genericEntryValidation },
  { name: 'professions', url: 'https://www.profesia.sk/praca/zoznam-pozicii/', numOfAssertCalls: 1, schema: genericEntryValidation  },
  { name: 'languages', url: 'https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/', numOfAssertCalls: 1, schema: genericEntryValidation  },
  { name: 'companies', url: 'https://www.profesia.sk/praca/zoznam-spolocnosti/', numOfAssertCalls: 2, schema: genericEntryValidation  },
  { name: 'locations', url: 'https://www.profesia.sk/praca/zoznam-lokalit/', numOfAssertCalls: 2, schema: locationEntryValidation  },
];

describe(
  ROUTE_LABEL_ENUM.JOB_RELATED_LIST,
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

    jobRelatedLists.forEach(({ name, url, schema, numOfAssertCalls }) => {
      it(`extracts ${name} data`, async () => {
        let calls = 0;
        return runCrawlerTest<any, ActorInput>({
          vi,
          input: { startUrls: [url], includePersonalData: true },
          runCrawler,
          onPushData: (data, done) => {
            expect(data.length).toBeGreaterThan(0);
            calls += 1;

            data.forEach((d) => Joi.assert(d, schema));
            if (calls >= numOfAssertCalls) done();
          },
        });
      });
    });
  },
  { timeout: 5_000 }
);
