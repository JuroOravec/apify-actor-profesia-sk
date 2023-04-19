import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';

import { runActorTest } from '../setup/apify';
import { routeLabels } from '../../src/constants';
import { partnerEntryValidation } from '../utils/assert';

const log = (...args) => console.log(...args);

describe(
  routeLabels.PARTNERS,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('extracts partners data', async () => {
      let calls = 0;
      return runActorTest({
        input: { startUrls: ['https://profesia.sk/partneri'] },
        onPushData: (data, done) => {
          expect(data.length).toBeGreaterThan(0);
          calls += 1;

          data.forEach((d) => Joi.assert(d, partnerEntryValidation));

          if (calls === 2) done();
        },
      });
    });
  },
  { timeout: 20_000 }
);
