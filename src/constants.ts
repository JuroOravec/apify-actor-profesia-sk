import type { DatasetType } from './types';

export const routeLabels = {
  JOB_LISTING: 'JOB_LISTING',
  JOB_DETAIL: 'JOB_DETAIL',
  JOB_RELATED_LIST: 'JOB_RELATED_LIST',
  PARTNERS: 'PARTNERS',
} as const;

export const datasetTypeToUrl: Record<DatasetType, string> = {
  jobOffers: 'https://profesia.sk/praca',
  industries: 'https://www.profesia.sk/praca/zoznam-pracovnych-oblasti',
  positions: 'https://www.profesia.sk/praca/zoznam-pozicii',
  companies: 'https://www.profesia.sk/praca/zoznam-spolocnosti',
  locations: 'https://www.profesia.sk/praca/zoznam-lokalit',
  languages: 'https://www.profesia.sk/praca/zoznam-jazykovych-znalosti',
  partners: 'https://www.profesia.sk/partneri',
};
