import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';

import { runActorTest } from '../setup/apify';
import { routeLabels } from '../../src/constants';
import { genericEntryValidation, locationEntryValidation } from '../utils/assert';

const log = (...args) => console.log(...args);

// prettier-ignore
const jobRelatedLists = [
  { name: 'industries', url: 'https://www.profesia.sk/praca/zoznam-pracovnych-oblasti/', numOfAssertCalls: 1, schema: genericEntryValidation },
  { name: 'positions', url: 'https://www.profesia.sk/praca/zoznam-pozicii/', numOfAssertCalls: 1, schema: genericEntryValidation  },
  { name: 'languages', url: 'https://www.profesia.sk/praca/zoznam-jazykovych-znalosti/', numOfAssertCalls: 1, schema: genericEntryValidation  },
  { name: 'companies', url: 'https://www.profesia.sk/praca/zoznam-spolocnosti/', numOfAssertCalls: 2, timeout: 30_000, schema: genericEntryValidation  },
  { name: 'locations', url: 'https://www.profesia.sk/praca/zoznam-lokalit/', numOfAssertCalls: 2, schema: locationEntryValidation  },
];

describe(
  routeLabels.JOB_RELATED_LIST,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    jobRelatedLists.forEach(({ name, url, schema, numOfAssertCalls, timeout }) => {
      it(
        `extracts ${name} data`,
        async () => {
          let calls = 0;
          return runActorTest({
            input: { startUrls: [url] },
            onPushData: (data, done) => {
              expect(data.length).toBeGreaterThan(0);
              calls += 1;

              data.forEach((d) => Joi.assert(d, schema));
              if (calls >= numOfAssertCalls) done();
            },
          });
        },
        { timeout: timeout ?? 20_000 }
      );
    });
  },
  { timeout: 20_000 }
);
