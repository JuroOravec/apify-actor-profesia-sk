import { describe, it, vi, beforeEach, expect } from 'vitest';
import Joi from 'joi';
import { runActorTest } from 'apify-actor-utils';

import { partnerEntryValidation } from '../utils/assert';
import { run } from '../../src/actor';
import { ROUTE_LABEL_ENUM } from '../../src/types';

const log = (...args) => console.log(...args);
const runActor = () => run({ useSessionPool: false, maxRequestRetries: 0 });

describe(
  ROUTE_LABEL_ENUM.PARTNERS,
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('extracts partners data', async () => {
      return runActorTest({
        vi,
        input: { startUrls: ['https://profesia.sk/partneri'] },
        runActor,
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
