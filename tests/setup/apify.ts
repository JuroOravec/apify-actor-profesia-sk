import { vi } from 'vitest';
import { Actor, RequestQueue } from 'apify';
import { Dictionary, KeyValueStore } from 'crawlee';

import { run } from '../../src/actor';
import type { MaybeArray, MaybePromise } from '../../src/utils/types';
import {
  OnBatchAddRequests,
  createMockStorageClient,
  createMockStorageDataset,
} from '../lib/apify-client';
import type { ProfesiaSkActorInput } from '../../src/types';

const setupMockApifyActor = async <
  TInput,
  TData extends MaybeArray<Dictionary> = MaybeArray<Dictionary>
>({
  actorInput,
  log,
  onPushData,
  onBatchAddRequests,
}: {
  actorInput?: TInput;
  log?: (...args: any[]) => void;
  onPushData?: (data: TData) => MaybePromise<void>;
  onBatchAddRequests?: OnBatchAddRequests;
} = {}) => {
  const mockStorageClient = createMockStorageClient({ log, onBatchAddRequests });

  vi.spyOn(Actor, 'main').mockImplementation(async (fn) => fn());
  vi.spyOn(Actor, 'getInput').mockImplementation(() => Promise.resolve(actorInput));

  vi.spyOn(Actor, 'openDataset').mockImplementation(async (datasetIdOrName, options) => {
    console.log('Mock Actor.openDataset: ', datasetIdOrName);
    return createMockStorageDataset(datasetIdOrName, options, { log });
  });
  vi.spyOn(Actor<TData>, 'pushData').mockImplementation(async (data) => {
    console.log('Mock Actor.pushData');
    if (onPushData) await onPushData(data as any);
  });

  vi.spyOn(RequestQueue, 'open').mockImplementation(async () => {
    const reqQueue = new RequestQueue({
      id: 'test',
      client: mockStorageClient,
    });
    return reqQueue;
  });

  vi.spyOn(KeyValueStore, 'open').mockImplementation(
    async () => new KeyValueStore({ id: 'keyvalstore', client: mockStorageClient })
  );

  await Actor.init();
};

export const runActorTest = async ({
  input,
  onPushData,
  onBatchAddRequests,
  onDone,
}: {
  input: ProfesiaSkActorInput;
  onPushData?: (data: any, done: () => void) => MaybePromise<void>;
  onBatchAddRequests?: OnBatchAddRequests;
  onDone?: (done: () => void) => MaybePromise<void>;
}) => {
  await new Promise<void>(async (done, rej) => {
    await setupMockApifyActor<ProfesiaSkActorInput>({
      actorInput: { ...input },
      // log,
      onPushData: (data) => onPushData?.(data, done),
      onBatchAddRequests,
    });

    await run({ useSessionPool: false, maxRequestRetries: 0 });
    await onDone?.(done);
  });
};
