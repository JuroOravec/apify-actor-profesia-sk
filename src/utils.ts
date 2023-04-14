import type { MaybePromise } from './types';

/** Repeat given function every `ms` until the function returns truthy value. */
export const poll = (fn: () => MaybePromise<boolean | void>, ms: number): Promise<void> => {
  return new Promise<void>((res, rej) => {
    const intervalId = setInterval(async () => {
      try {
        const val = await fn();
        if (!val) return;
      } catch (err) {
        rej(err);
      }
      // Polled successfully, clean up
      clearInterval(intervalId);
      res();
    }, ms);
  });
};
