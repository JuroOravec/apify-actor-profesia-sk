import type { Log } from 'apify';
import { chunk } from 'lodash';

import type {
  EmploymentType,
  ProfesiaSkJobOfferDescriptionFields,
  SimpleProfesiaSKJobOfferItem,
  JobOfferCategoryItem,
  ProfesiaSkJobOfferSalaryFields,
  DetailedProfesiaSKJobOfferItem,
} from '../types';
import type { DOMLib } from '../lib/dom';

const employmentTypeInfo: Record<EmploymentType, { urlPath: string; text: string }> = {
  fte: { urlPath: 'plny-uvazok', text: 'plný úväzok' },
  pte: { urlPath: 'skrateny-uvazok', text: 'skrátený úväzok' },
  selfemploy: { urlPath: 'zivnost', text: 'živnosť' },
  voluntary: { urlPath: 'na-dohodu-brigady', text: 'na dohodu (brigády)' },
  internship: { urlPath: 'internship-staz', text: 'internship, stáž' },
};

const descriptionSections = [
  {
    selector: '.job-info',
    subsections: {
      jobInfoResponsibilities: ['náplň práce', 'právomoci', 'zodpovednosti'],
      jobInfoBenefits: ['výhody', 'benefity'],
      jobInfoDeadline: ['termín', 'ukončenia', 'výberového konania'],
    },
  },
  {
    selector: '.job-requirements',
    subsections: {
      jobReqEducation: ['vzdelaním'],
      jobReqExpertise: ['vzdelanie v odbore'],
      jobReqLanguage: ['jazykové'],
      jobReqOther: ['ostatné'],
      jobReqDriversLicense: ['vodičský'],
      jobReqIndustry: ['pozícii', 'v oblasti'],
      jobReqSuitableForGraduate: ['absolventa'],
      jobReqPersonalSkills: ['osobnostné', 'predpoklady', 'zručnosti'],
    },
  },
  {
    selector: '.company-info',
    subsections: {
      employerDescription: ['charakteristika spoločnosti'],
      employeeCount: ['počet zamestnancov'],
      employerContact: ['kontakt'],
    },
  },
] as const;

export const jobDetailDOMActions = {
  // - https://www.profesia.sk/praca/komix-sk/O4556386
  // - https://www.profesia.sk/praca/accenture/O4491399
  // - https://www.profesia.sk/praca/gohealth/O3964543
  // - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
  extractJobDetail: <T>({
    domLib,
    log,
    jobData,
  }: {
    domLib: DOMLib<T>;
    log: Log;
    /**
     * In case we've come across this job ad on a listing page, we pass it here
     * in case there's some data that was available then which is not here */
    jobData?: SimpleProfesiaSKJobOfferItem;
  }): DetailedProfesiaSKJobOfferItem => {
    log.info(`Extracting job details from the page`);
    const rootEl = domLib.root();

    const containerEl = domLib.findOne(rootEl, '#content .container');
    const entryEl = domLib.findOne(containerEl, '#detail .card-content');

    const labels = domLib
      .findMany(containerEl, '.label')
      .map((el) => domLib.textAsLower(el))
      .filter(Boolean) as string[];

    const offerUrl = domLib.url();
    const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

    const salaryText = domLib.findOne(entryEl, '.salary-range', (el) => domLib.text(el));
    const salaryFields = jobDetailMethods.parseSalaryText(salaryText);

    const basicFields = jobDetailDOMActions.extractJobDetailBasicInfo(domLib, entryEl);
    const descriptionFields = jobDetailDOMActions.extractJobDetailDescriptionInfo(domLib, entryEl); // prettier-ignore
    const categFields = jobDetailDOMActions.extractJobDetailCategories(domLib, entryEl);

    const entry = {
      // Add the fields we've got from listing page
      ...jobData,
      listingUrl: jobData?.listingUrl ?? null,
      lastChangeRelativeTime: jobData?.lastChangeRelativeTime ?? null,
      lastChangeType: jobData?.lastChangeType ?? null,

      ...basicFields,
      ...salaryFields,
      ...descriptionFields,
      ...categFields,

      offerUrl,
      offerId,
      labels,
    };

    log.info(`Done extracting job details from the page (ID: ${entry.offerId})`);
    return entry;
  },

  extractJobDetailBasicInfo: <T>(domLib: DOMLib<T>, entryEl: T | null) => {
    const offerName = domLib.findOne(entryEl, '[itemprop="title"]', (el) => domLib.text(el));

    const baseUrl = domLib.url();
    const employerName = domLib.findOne(entryEl, '[itemprop="hiringOrganization"]', (el) => domLib.text(el)); // prettier-ignore
    const employerUrl = domLib.findOne(entryEl, '.easy-design-btn-offer-list', (el) => domLib.href(el, { baseUrl })); // prettier-ignore
    const employerLogoUrl = domLib.findOne(entryEl, '.easy-design-logo img', (el) => domLib.src(el, { baseUrl })); // prettier-ignore

    const employmentTypesText = domLib.findOne(entryEl, '[itemprop="employmentType"]', (el) => domLib.text(el)); // prettier-ignore
    const employmentTypes = Object.entries(employmentTypeInfo).reduce<EmploymentType[]>((agg, [key, { text }]) => {
      if (employmentTypesText?.includes(text)) agg.push(key as EmploymentType);
      return agg;
    }, []); // prettier-ignore

    const startDate = domLib.findOne(entryEl, '.panel-body > .row:nth-child(2) > div:nth-child(1) span', (el) => domLib.text(el)); // prettier-ignore
    const location = domLib.findOne(entryEl, '[itemprop="jobLocation"]', (el) => domLib.text(el));

    const phoneNumbers = domLib
      .findMany(entryEl, '.details-section .tel', (el) => domLib.text(el))
      .filter((el) => el) as string[];

    const datePosted = domLib.findOne(entryEl, '[itemprop="datePosted"]', (el) => domLib.text(el));

    return {
      offerName,
      employerName,
      employerUrl,
      employerLogoUrl,
      employmentTypes,
      startDate,
      location,
      phoneNumbers,
      datePosted,
    };
  },

  extractJobDetailDescriptionInfo: <T>(domLib: DOMLib<T>, entryEl: T | null) => {
    const descriptionInfo = descriptionSections.reduce<ProfesiaSkJobOfferDescriptionFields>(
      (agg, { subsections, selector }) => {
        const sectionEl = domLib.findOne(entryEl, selector);
        domLib.findOne(sectionEl, '.subtitle-line', (el) => domLib.remove(el));

        const sectionEls = domLib.children(sectionEl);
        chunk(sectionEls, 2).forEach(([titleEl, contentEl]) => {
          const titleText = domLib.textAsLower(titleEl);

          for (const [subsection, fragments] of Object.entries(subsections)) {
            if (fragments.some((text: string) => titleText?.includes(text))) {
              domLib.findMany(contentEl, '.text-gray', (el) => domLib.remove(el));
              const key = subsection as keyof ProfesiaSkJobOfferDescriptionFields;
              agg[key] = domLib.text(contentEl);
            }
          }
        });
        return agg;
      },
      {} as any
    );

    return descriptionInfo;
  },

  extractJobDetailCategories: <T>(domLib: DOMLib<T>, entryEl: T | null) => {
    const baseUrl = domLib.url();

    const locationCategs: JobOfferCategoryItem[] = [];
    const positionCategs: JobOfferCategoryItem[] = [];

    let currHeading: string | null;
    // prettier-ignore
    domLib.findOne(entryEl, '.overall-info .hidden-xs', (el) => domLib.children(el))?.forEach((el) => {
      const nodeName = domLib.nodeName(el);
      if (nodeName === 'STRONG') {
        currHeading = domLib.textAsLower(el);
        return;
      }
      if (nodeName === 'A' && currHeading?.includes('lokalit')) {
        locationCategs.push({
          url: domLib.href(el, { baseUrl }),
          name: domLib.text(el),
        });
      }
      if (nodeName === 'A' && currHeading?.includes('pozícia')) {
        positionCategs.push({
          url: domLib.href(el, { baseUrl }),
          name: domLib.text(el),
        });
      }
    });

    return { locationCategs, positionCategs };
  },
};

export const jobDetailMethods = {
  parseSalaryText: (salaryText: string | null): ProfesiaSkJobOfferSalaryFields => {
    // Try to parse texts like "Od 6,5 EUR/hod."
    let parsedSalary = salaryText?.match(/^[a-z]*\s*(?<lowVal>[\d, ]+)\s*(?<curr>[\w\p{L}\p{M}\p{Zs}]+)\/(?<period>\w+)/iu); // prettier-ignore
    // Try to parse texts like "35 000 - 45 000 Kč/mesiac"
    if (!parsedSalary) parsedSalary = salaryText?.match(/^(?<lowVal>[\d,. ]+)\s*-\s*(?<upVal>[\d,. ]+)(?<curr>[\w\p{L}\p{M}\p{Zs}]+)\/(?<period>\w+)/iu); // prettier-ignore

    const { groups } = parsedSalary || { groups: { lowVal: '', upVal: '', curr: '', period: '' } }; // prettier-ignore
    const { lowVal, upVal, curr, period } = groups || {};

    const salaryRangeLower = lowVal != null ? Number.parseInt(lowVal.replace(/\s/g, '')) : null;
    const salaryRangeUpper = upVal != null ? Number.parseInt(upVal.replace(/\s/g, '')) : null;

    return {
      salaryRange: salaryText || null,
      salaryRangeLower: Number.isNaN(salaryRangeLower) ? null : salaryRangeLower,
      salaryRangeUpper: Number.isNaN(salaryRangeUpper) ? null : salaryRangeUpper,
      salaryCurrency: curr || null,
      salaryPeriod: period || null,
    };
  },
};
