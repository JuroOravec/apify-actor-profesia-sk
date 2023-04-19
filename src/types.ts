export type WorkFromHomeType = 'fullRemote' | 'partialRemote' | 'noRemote';
export type SalaryPeriod = 'month' | 'hour';
export type EmploymentType = 'fte' | 'pte' | 'selfemploy' | 'voluntary' | 'internship';
export type DatasetType = 'jobOffers' | 'industries' | 'positions' | 'companies' | 'languages' | 'locations' | 'partners'; // prettier-ignore

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
