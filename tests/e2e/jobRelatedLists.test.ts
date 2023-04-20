import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runActorTest } from 'apify-actor-utils';

import { routeLabels } from '../../src/constants';
import { genericEntryValidation, locationEntryValidation } from '../utils/assert';
import { run } from '../../src/actor';

const log = (...args) => console.log(...args);
const runActor = () => run({ useSessionPool: false, maxRequestRetries: 0 });

// prettier-ignore
const jobRelatedLists = [
  { name: 'industries', url: 'https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/', numOfAssertCalls: 1, schema: genericEntryValidation },
  { name: 'positions', url: 'https://www.profesia.sk/praca/zoznam-pozicii/', numOfAssertCalls: 1, schema: genericEntryValidation  },
  { name: 'languages', url: 'https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/', numOfAssertCalls: 1, schema: genericEntryValidation  },
  { name: 'companies', url: 'https://www.profesia.sk/praca/zoznam-spolocnosti/', numOfAssertCalls: 2, schema: genericEntryValidation  },
  { name: 'locations', url: 'https://www.profesia.sk/praca/zoznam-lokalit/', numOfAssertCalls: 2, schema: locationEntryValidation  },
];

describe(
  routeLabels.JOB_RELATED_LIST,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    jobRelatedLists.forEach(({ name, url, schema, numOfAssertCalls }) => {
      it(`extracts ${name} data`, async () => {
        let calls = 0;
        return runActorTest({
          vi,
          input: { startUrls: [url] },
          runActor,
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
