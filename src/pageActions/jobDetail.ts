import type { Log } from 'apify';
import { chunk } from 'lodash';
import type { DOMLib } from 'crawlee-one';

import {
  EmploymentType,
  ProfesiaSkJobOfferDescriptionFields,
  SimpleProfesiaSKJobOfferItem,
  JobOfferCategoryItem,
  ProfesiaSkJobOfferSalaryFields,
  DetailedProfesiaSKJobOfferItem,
  SALARY_PERIOD_ENUM,
} from '../types';
import { serialAsyncMap } from '../utils/async';

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
  extractJobDetail: async <T extends DOMLib<any, any>>({
    domLib,
    log,
    jobData,
  }: {
    domLib: T;
    log: Log;
    /**
     * In case we've come across this job ad on a listing page, we pass it here
     * in case there's some data that was available then which is not here */
    jobData?: SimpleProfesiaSKJobOfferItem;
  }) => {
    log.info(`Extracting job details from the page`);
    const rootEl = await domLib.root();

    const containerEl = await rootEl?.findOne('#content .container');
    const entryEl = (await containerEl?.findOne('#detail .card-content')) ?? null;

    const labelEls = (await containerEl?.findMany('.label')) ?? [];
    const labels = (await serialAsyncMap(labelEls, (el) => el.textAsLower())).filter(
      Boolean
    ) as string[];

    const offerUrl = await domLib.url();
    const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

    const salaryText = (await (await entryEl?.findOne('.salary-range'))?.text()) ?? null;
    const salaryFields = jobDetailMethods.parseSalaryText(salaryText);

    const basicFields = await jobDetailDOMActions.extractJobDetailBasicInfo(entryEl);
    const descriptionFields = await jobDetailDOMActions.extractJobDetailDescriptionInfo(entryEl); // prettier-ignore
    const categFields = await jobDetailDOMActions.extractJobDetailCategories(entryEl);

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
    } satisfies DetailedProfesiaSKJobOfferItem;

    log.info(`Done extracting job details from the page (ID: ${entry.offerId})`);
    return entry;
  },

  extractJobDetailBasicInfo: async <T extends DOMLib<object, any>>(domLib: T | null) => {
    const offerName = (await (await domLib?.findOne('[itemprop="title"]'))?.text()) ?? null;

    const baseUrl = (await domLib?.url()) ?? null;
    const employerName = await (await domLib?.findOne('[itemprop="hiringOrganization"]'))?.text() ?? null; // prettier-ignore
    const employerUrl = await (await domLib?.findOne('.easy-design-btn-offer-list'))?.href({ baseUrl }) ?? null; // prettier-ignore
    const employerLogoUrl = await (await domLib?.findOne('.easy-design-logo img'))?.src({ baseUrl }) ?? null; // prettier-ignore

    const employmentTypesText = await (await domLib?.findOne('[itemprop="employmentType"]'))?.text() ?? null; // prettier-ignore
    const employmentTypes = Object.entries(employmentTypeInfo).reduce<EmploymentType[]>((agg, [key, { text }]) => {
      if (employmentTypesText?.includes(text)) agg.push(key as EmploymentType);
      return agg;
    }, []); // prettier-ignore

    const startDate = await (await domLib?.findOne('.panel-body > .row:nth-child(2) > div:nth-child(1) span'))?.text() ?? null; // prettier-ignore
    const location = (await (await domLib?.findOne('[itemprop="jobLocation"]'))?.text()) ?? null;

    const phoneEls = (await domLib?.findMany('.details-section .tel')) ?? [];
    const phoneNumbers = (await serialAsyncMap(phoneEls, (el) => el.text()))
      .filter(Boolean) as string[]; // prettier-ignore

    const datePosted = (await (await domLib?.findOne('[itemprop="datePosted"]'))?.text()) ?? null;

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

  extractJobDetailDescriptionInfo: <T extends DOMLib<object, any>>(domLib: T | null) => {
    const descriptionInfo = descriptionSections.reduce<
      Promise<ProfesiaSkJobOfferDescriptionFields>
    >(async (promiseAgg, { subsections, selector }) => {
      const agg = await promiseAgg;
      const sectionEl = await domLib?.findOne(selector);
      await (await sectionEl?.findOne('.subtitle-line'))?.remove();

      const sectionEls = (await sectionEl?.children()) ?? [];
      for (const [titleEl, contentEl] of chunk(sectionEls, 2)) {
        const titleText = await titleEl.textAsLower();

        for (const [subsection, fragments] of Object.entries(subsections)) {
          const textMatches = fragments.some((text: string) => titleText?.includes(text));
          if (!textMatches) continue;

          const greyTextEls = (await contentEl?.findMany('.text-gray')) ?? [];
          await serialAsyncMap(greyTextEls, (el) => el.remove());

          const key = subsection as keyof ProfesiaSkJobOfferDescriptionFields;
          agg[key] = await contentEl.text();
        }
      }

      return agg;
    }, Promise.resolve({} as any));

    return descriptionInfo;
  },

  extractJobDetailCategories: async <T extends DOMLib<object, any>>(domLib: T | null) => {
    const baseUrl = await domLib?.url();

    const locationCategs: JobOfferCategoryItem[] = [];
    const professionCategs: JobOfferCategoryItem[] = [];

    let currHeading: string | null = null;
    // prettier-ignore
    const children = await (await domLib?.findOne('.overall-info .hidden-xs'))?.children() ?? [];
    for (const el of children) {
      const nodeName = await el.nodeName();
      if (nodeName === 'STRONG') {
        currHeading = await el.textAsLower();
        continue;
      }

      if (nodeName === 'A' && currHeading?.includes('lokalit')) {
        locationCategs.push({
          url: await el.href({ baseUrl }),
          name: await el.text(),
        });
      }

      if (nodeName === 'A' && currHeading?.includes('pozícia')) {
        professionCategs.push({
          url: await el.href({ baseUrl }),
          name: await el.text(),
        });
      }
    }

    return { locationCategs, professionCategs };
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

    const salaryPeriod = period === 'hod'
      ? SALARY_PERIOD_ENUM.hour
      : period === 'mesiac'
      ? SALARY_PERIOD_ENUM.month
      : period; // prettier-ignore

    return {
      salaryRange: salaryText || null,
      salaryRangeLower: Number.isNaN(salaryRangeLower) ? null : salaryRangeLower,
      salaryRangeUpper: Number.isNaN(salaryRangeUpper) ? null : salaryRangeUpper,
      salaryCurrency: curr?.toLocaleLowerCase() || null,
      salaryPeriod: salaryPeriod || null,
    };
  },
};
