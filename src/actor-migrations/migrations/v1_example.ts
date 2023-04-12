import type { ApifyClient } from 'apify-client';

import { loadState, saveState } from '../utils/fs';

// This file is an example of how to make changes to the actors
// programmatically in a documented way.
// https://docs.apify.com/academy/getting-started/apify-client

/** Run the migration forward */
export const migrate = async (client: ApifyClient): Promise<void> => {
  const actor = client.actor('YOUR_USERNAME/adding-actor');
  // console.log({ actorClient: actor, actorData: await actor.get() });

  await saveState(__filename, { get: () => ({} as any) } as any);

  // await actor.update({
  //   defaultRunOptions: {
  //     build: 'latest',
  //     memoryMbytes: 256,
  //     timeoutSecs: 20,
  //   },
  // });
};

/** Run the migration backward (AKA undo the migration), if old state is available */
export const unmigrate = async (client: ApifyClient): Promise<void> => {
  const actor = client.actor('YOUR_USERNAME/adding-actor');

  const oldActorState = await loadState(__filename);

  // await actor.update({
  //   defaultRunOptions: oldActorState.defaultRunOptions,
  // });
};
