// From https://docs.apify.com/academy/expert-scraping-with-apify/solutions/saving-stats

import { Actor } from 'apify';

const createStats = () => {
  const state = {
    errors: {} as Record<string, string[]>,
    totalSaved: 0,
  };

  const initialize = async () => {
    const data = await Actor.getValue('STATS');

    if (data) Object.assign(state, data);

    Actor.on('persistState', async () => {
      await Actor.setValue('STATS', state);
    });

    setInterval(() => console.log(state), 10000);
  };

  const addError = (url: string, errorMessage: string) => {
    if (!state.errors?.[url]) state.errors[url] = [];
    state.errors[url].push(errorMessage);
  };

  const success = () => {
    state.totalSaved += 1;
  };

  return {
    initialize,
    addError,
    success,
  };
};

export const stats = createStats();
