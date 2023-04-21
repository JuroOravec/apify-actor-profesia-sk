import type { ProxyConfigurationOptions } from 'apify';
import { fromPairs } from 'lodash';

import type { ArrVal } from './utils/types';
import { CheerioCrawlerOptions } from 'crawlee';

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

/** Crawler config fields that can be overriden from the actor input */
type OverridableCrawlerConfigActorInput = Pick<
  CheerioCrawlerOptions,
  | 'navigationTimeoutSecs'
  | 'ignoreSslErrors'
  | 'additionalMimeTypes'
  | 'suggestResponseEncoding'
  | 'forceResponseEncoding'
  | 'requestHandlerTimeoutSecs'
  | 'maxRequestRetries'
  | 'maxRequestsPerCrawl'
  | 'maxRequestsPerMinute'
  | 'minConcurrency'
  | 'maxConcurrency'
  | 'keepAlive'
>;

export interface DefaultActorInput extends OverridableCrawlerConfigActorInput {
  proxy?: ProxyConfigurationOptions;
}

/** Shape of the data passed to the actor from Apify */
export interface ProfesiaSkActorInput extends DefaultActorInput {
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
  /** Listing URL from which this entry was taken. E.g. `"https://www.profesia.sk/praca/` */
  listingUrl: string | null;
  /** Eg `"EF Logistic Services s.r.o."` */
  employerName: string | null;
  /** Eg `"https://www.profesia.sk/praca/porsche-werkzeugbau/C187860"` */
  employerUrl: string | null;
  /** Eg `"https://www.profesia.sk/customdesigns/EasyDesign/1/292/images/187860/logo.png"` */
  employerLogoUrl: string | null;

  /** Eg `"Podpora predaja so slovinským jazykom"` */
  offerName: string | null;
  /** Eg `"https://www.profesia.sk/praca/ef-logistic-services/O3720779"` */
  offerUrl: string | null;
  /** Eg `"O3720779"` */
  offerId: string | null;

  /** Eg `"P3 Logistic Parks: P3 Bratislava D2, Lozorno"` */
  location: string | null;
  /** Eg `["reagujte bez životopisu"]` */
  labels: string[];
  /** Eg `"pred 4 minútami"` */
  lastChangeRelativeTime: string | null;
  /** Eg `"added"` */
  lastChangeType: string | null;
}

export interface DetailedProfesiaSKJobOfferItem
  extends SimpleProfesiaSKJobOfferItem,
    ProfesiaSkJobOfferDescriptionFields {
  /** Eg `["fte", "selfemploy"]` */
  employmentTypes: EmploymentType[];
  /** Eg `"1.5.2023"` or `"ASAP"` or `"2023-08-21"` */
  startDate: string | null;
  /** Eg `["+421327746301"]` */
  phoneNumbers: string[];
  /** Eg `"2023-04-21"` */
  datePosted: string | null;

  /** Eg `[{ url: "https://www.profesia.sk/praca/bratislava/?page_num=3", name: "Bratislava" }]` */
  locationCategs: JobOfferCategoryItem[];
  /** Eg `[{ url: "https://www.profesia.sk/praca/asistent-auditora/", name: "Asistent audítora" }]` */
  positionCategs: JobOfferCategoryItem[];
}

export interface JobOfferCategoryItem {
  url: string | null;
  name: string | null;
}

export interface ProfesiaSkJobOfferDescriptionFields {
  /** Eg `"- kontrola a skladovanie náhradných dielov\n- prebaľovanie materiálu\n- označovanie materiálu - nalepenie etikety na prebalený materiál"` */
  jobInfoResponsibilities: string | null;
  /** Eg `"Zamestnancom poskytujeme zaujímavé finančné ohodnotenie a širokú škálu benefitov:\n- stravné lístky v hodnote 6€"` */
  jobInfoBenefits: string | null;
  /** Eg `"15.5.2023"` */
  jobInfoDeadline: string | null;
  /** Eg `"základné vzdelanie\nstredoškolské bez maturity\nstredoškolské s maturitou\nnadstavbové/vyššie odborné vzdelanie"` */
  jobReqEducation: string | null;
  /** Eg `"zameranie na techniku, technické vzdelanie v oblasti strojárstva"` */
  jobReqExpertise: string | null;
  /** Eg `"Anglický jazyk - Mierne pokročilý (B1) a Slovenský jazyk - Stredne pokročilý (B2) a Slovinský jazyk - Pokročilý (C1)"` */
  jobReqLanguage: string | null;
  /** Eg `"Microsoft Outlook - Mierne pokročilýMicrosoft Excel - Mierne pokročilý"` */
  jobReqOther: string | null;
  /** Eg `"B"` */
  jobReqDriversLicense: string | null;
  /** Eg `"Zvárač"` or `"Podmienkou je skúsenosť v predaji poľnohospodárskej techniky alebo vzdelanosť v odbore"` */
  jobReqIndustry: string | null;
  /** Eg `"Áno"` */
  jobReqSuitableForGraduate: string | null;
  /** Eg `"- manuálna zručnosť - ochota a chuť pracovať - dochvíľnosť"` */
  jobReqPersonalSkills: string | null;
  /** Eg `"Spoločnosť EF Logistic Services s.r.o. sa zaoberá logistikou - distribúciou a skladovaním nových náhradných dielov."` */
  employerDescription: string | null;
  /** Eg `"50-99 zamestnancov"` */
  employeeCount: string | null;
  /** Eg `"Kontaktná osoba: Mgr.  Dominika KotradyováE-mail: poslať životopis"` */
  employerContact: string | null;
}

export interface ProfesiaSkJobOfferSalaryFields {
  /** Eg `"901 - 1 231 EUR/mesiac"` */
  salaryRange: string | null;
  /** Eg `901` */
  salaryRangeLower: number | null;
  /** Eg `1231` */
  salaryRangeUpper: number | null;
  /** Eg `eur` */
  salaryCurrency: string | null;
  /** Eg `month` */
  salaryPeriod: string | null;
}
