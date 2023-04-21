import { fromPairs } from 'lodash';

import type { ArrVal } from './utils/types';

const enumFromArray = <T extends readonly any[]>(arr: T) => {
  return fromPairs(arr.map((k) => [k, k])) as { [Key in ArrVal<T>]: Key };
};

export const SALARY_PERIOD = ['month', 'hour'] as const;
export const SALARY_PERIOD_ENUM = enumFromArray(SALARY_PERIOD);
export type SalaryPeriod = ArrVal<typeof SALARY_PERIOD>;

export const WORK_FROM_HOME_TYPE = ['fullRemote', 'partialRemote', 'noRemote'] as const; // prettier-ignore
export type WorkFromHomeType = ArrVal<typeof WORK_FROM_HOME_TYPE>;

export const EMPLOYMENT_TYPE = ['fte', 'pte', 'selfemploy', 'voluntary', 'internship'] as const; // prettier-ignore
export type EmploymentType = ArrVal<typeof EMPLOYMENT_TYPE>;

export const DATASET_TYPE = ['jobOffers', 'industries', 'positions', 'companies', 'languages', 'locations', 'partners'] as const; // prettier-ignore
export type DatasetType = ArrVal<typeof DATASET_TYPE>;

export const ROUTE_LABELS = ['JOB_LISTING', 'JOB_DETAIL', 'JOB_RELATED_LIST', 'PARTNERS'] as const;
export const ROUTE_LABEL_ENUM = enumFromArray(ROUTE_LABELS);
export type RouteLabel = ArrVal<typeof ROUTE_LABELS>;

/** Shape of the data passed to the actor from Apify */
export interface ProfesiaSkActorInput {
  /** Choose what kind of data you want to extract - job offers, list of companies, list of industries, ... */
  datasetType?: DatasetType;
  /** URLs to start with */
  startUrls?: string[];
  /** If checked, the scraper will obtain more detailed info for job offers by visit the details page of each job offer to extract data. If un-checked, only the data from the listing page is extracted. For details, please refer to http://apify.com/store/jurooravec/profesia-sk-scraper#output */
  jobOfferDetailed?: boolean;
  /** If given, only entries matching the query will be retrieved (full-text search) */
  jobOfferFilterQuery?: string;
  /** If set, only up to this number of entries will be extracted */
  jobOfferFilterMaxCount?: number;
  /** If set, only entries offering this much or more will be extracted */
  jobOfferFilterMinSalaryValue?: number;
  /** Choose if the minimum salary is in per hour or per month format */
  jobOfferFilterMinSalaryPeriod?: SalaryPeriod;
  /** If set, only entries with this employment filter will be extracted */
  jobOfferFilterEmploymentType?: EmploymentType;
  /** If set, only entries with this type of remote work filter will be extracted */
  jobOfferFilterRemoteWorkType?: WorkFromHomeType;
  /** If set, only entries this much days old will be extracted. E.g. 7 = 1 week old, 31 = 1 month old, ... */
  jobOfferFilterLastNDays?: number;
  /** If checked, no data is extracted. Instead, the count of matched job offers is printed in the log. */
  jobOfferCountOnly?: boolean;
}

export interface SimpleProfesiaSKJobOfferItem extends ProfesiaSkJobOfferSalaryFields {
  listingUrl: string | null;
  /** Eg `"moJRLRc85AitArpNN"` */ // TODO
  employerName: string | null;
  employerUrl: string | null;
  employerLogoUrl: string | null;

  offerName: string | null;
  offerUrl: string | null;
  offerId: string | null;

  location: string | null;
  labels: string[];
  lastChangeRelativeTime: string | null;
  lastChangeType: string | null;
}

export interface DetailedProfesiaSKJobOfferItem
  extends SimpleProfesiaSKJobOfferItem,
    ProfesiaSkJobOfferDescriptionFields {
  /** Eg `"moJRLRc85AitArpNN"` */ // TODO
  employmentTypes: EmploymentType[];
  startDate: string | null;
  phoneNumbers: string[];
  datePosted: string | null;

  locationCategs: JobOfferCategoryItem[];
  positionCategs: JobOfferCategoryItem[];
}

export interface JobOfferCategoryItem {
  url: string | null;
  name: string | null;
}

export interface ProfesiaSkJobOfferDescriptionFields {
  jobInfoResponsibilities: string | null;
  jobInfoBenefits: string | null;
  jobInfoDeadline: string | null;
  jobReqEducation: string | null;
  jobReqExpertise: string | null;
  jobReqLanguage: string | null;
  jobReqOther: string | null;
  jobReqDriversLicense: string | null;
  jobReqIndustry: string | null;
  jobReqSuitableForGraduate: string | null;
  jobReqPersonalSkills: string | null;
  employerDescription: string | null;
  employeeCount: string | null;
  employerContact: string | null;
}

export interface ProfesiaSkJobOfferSalaryFields {
  salaryRange: string | null;
  salaryRangeLower: number | null;
  salaryRangeUpper: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}
