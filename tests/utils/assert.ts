import Joi from 'joi';
import type { ActorEntryMetadata, WithActorEntryMetadata } from 'apify-actor-utils';

import {
  DetailedProfesiaSKJobOfferItem,
  EMPLOYMENT_TYPE,
  JobOfferCategoryItem,
  SimpleProfesiaSKJobOfferItem,
} from '../../src/types';
import type { GenericListEntry } from '../../src/pageActions/jobRelatedLists';
import type { PartnerEntry } from '../../src/pageActions/partners';

////////////////////////
// Numbers
////////////////////////
export const joiNumIntNonNeg = Joi.number().integer().min(0);
export const joiNumIntNonNegNullable = Joi.number().integer().min(0).allow(null);

////////////////////////
// Strings
////////////////////////
export const joiStrNotEmpty = Joi.string().min(1);
export const joiStrNotEmptyNullable = joiStrNotEmpty.allow(null);

////////////////////////
// URLs
////////////////////////
export const joiUrlNotEmpty = Joi.string()
  .min(1)
  .uri({ scheme: ['http', 'https'] });
export const joiUrlNotEmptyNullable = joiUrlNotEmpty.allow(null);

// www.profesia.sk
export const joiProfesiaUrl = Joi.string()
  .min(1)
  .uri({
    scheme: ['http', 'https'],
    domain: {
      minDomainSegments: 2,
      maxDomainSegments: 3,
      tlds: { allow: ['sk'] },
    },
  });
export const joiProfesiaUrlNullable = joiProfesiaUrl.allow(null);

////////////////////////
// Objects
////////////////////////
export const metadataValidation = Joi.object<ActorEntryMetadata>({
  actorId: joiStrNotEmptyNullable,
  actorRunId: joiStrNotEmptyNullable,
  actorRunUrl: joiUrlNotEmptyNullable,
  contextId: joiStrNotEmpty,
  requestId: joiStrNotEmptyNullable,
  originalUrl: joiUrlNotEmptyNullable,
  loadedUrl: joiUrlNotEmptyNullable,
  dateHandled: Joi.date().iso(),
  numberOfRetries: joiNumIntNonNeg,
});

export const simpleJobOfferValidation = Joi.object<
  WithActorEntryMetadata<SimpleProfesiaSKJobOfferItem>
>({
  listingUrl: joiProfesiaUrlNullable,

  employerName: joiStrNotEmptyNullable,
  employerUrl: joiProfesiaUrlNullable,
  employerLogoUrl: joiStrNotEmptyNullable,

  offerName: joiStrNotEmptyNullable,
  offerUrl: joiProfesiaUrlNullable,
  offerId: joiStrNotEmptyNullable,

  salaryRange: joiStrNotEmptyNullable,
  salaryRangeLower: joiNumIntNonNegNullable,
  salaryRangeUpper: joiNumIntNonNegNullable,
  salaryCurrency: joiStrNotEmptyNullable,
  salaryPeriod: joiStrNotEmptyNullable,

  location: joiStrNotEmptyNullable,
  labels: Joi.array().items(joiStrNotEmptyNullable),
  lastChangeRelativeTime: joiStrNotEmptyNullable,
  lastChangeType: joiStrNotEmptyNullable,
  metadata: metadataValidation,
});

const jobOfferCategoryValidation = Joi.object<JobOfferCategoryItem>({
  url: joiStrNotEmptyNullable,
  name: joiStrNotEmptyNullable,
});

export const joiEmploymentType = joiStrNotEmpty.valid(...EMPLOYMENT_TYPE); // prettier-ignore
export const detailedJobOfferValidation = simpleJobOfferValidation.keys({
  employmentTypes: Joi.array().min(1).items(joiEmploymentType),
  startDate: joiStrNotEmpty,
  phoneNumbers: Joi.array().items(joiStrNotEmpty),
  datePosted: Joi.date().iso(),

  locationCategs: Joi.array().items(jobOfferCategoryValidation),
  professionCategs: Joi.array().items(jobOfferCategoryValidation),

  jobInfoResponsibilities: joiStrNotEmptyNullable,
  jobInfoBenefits: joiStrNotEmptyNullable,
  jobInfoDeadline: joiStrNotEmptyNullable,
  jobReqEducation: joiStrNotEmptyNullable,
  jobReqExpertise: joiStrNotEmptyNullable,
  jobReqIndustry: joiStrNotEmptyNullable,
  jobReqLanguage: joiStrNotEmptyNullable,
  jobReqDriversLicense: joiStrNotEmptyNullable,
  jobReqOther: joiStrNotEmptyNullable,
  jobReqSuitableForGraduate: joiStrNotEmptyNullable,
  jobReqPersonalSkills: joiStrNotEmptyNullable,
  employerDescription: joiStrNotEmptyNullable,
  employeeCount: joiStrNotEmptyNullable,
  employerContact: joiStrNotEmptyNullable,
} as any) as Joi.ObjectSchema<WithActorEntryMetadata<DetailedProfesiaSKJobOfferItem>>;

export const genericEntryValidation = Joi.object<WithActorEntryMetadata<GenericListEntry>>({
  name: joiStrNotEmpty,
  url: joiProfesiaUrl,
  count: joiNumIntNonNeg,
  metadata: metadataValidation,
});

export const locationEntryValidation = genericEntryValidation.keys({
  region: joiStrNotEmptyNullable,
  country: joiStrNotEmpty,
} as any);

export const partnerEntryValidation = Joi.object<WithActorEntryMetadata<PartnerEntry>>({
  name: joiStrNotEmptyNullable,
  url: joiUrlNotEmpty,
  description: joiStrNotEmptyNullable,
  logoUrl: joiProfesiaUrlNullable,
  category: joiStrNotEmptyNullable,
  metadata: metadataValidation,
});
