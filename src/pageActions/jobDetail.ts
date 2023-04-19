import type { Log } from 'apify';
import { AnyNode, Cheerio, CheerioAPI } from 'cheerio';
import { chunk } from 'lodash';

import type {
  EmploymentType,
  ProfesiaSkJobOfferDescriptionFields,
  SimpleProfesiaSKJobOfferItem,
  JobOfferCategoryItem,
  ProfesiaSkJobOfferSalaryFields,
  DetailedProfesiaSKJobOfferItem,
} from '../types';

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

export const jobDetailPageActions = {
  // - https://www.profesia.sk/praca/komix-sk/O4556386
  // - https://www.profesia.sk/praca/accenture/O4491399
  // - https://www.profesia.sk/praca/gohealth/O3964543
  // - https://www.profesia.sk/praca/ing-lukas-hromjak/O4068250
  extractJobDetail: ({
    cheerioDom,
    log,
    url,
    jobData,
  }: {
    cheerioDom: CheerioAPI;
    log: Log;
    url?: string;
    /**
     * In case we've come across this job ad on a listing page, we pass it here
     * in case there's some data that was available then which is not here */
    jobData?: SimpleProfesiaSKJobOfferItem;
  }): DetailedProfesiaSKJobOfferItem => {
    log.info(`Extracting job details from the page`);
    const containerEl = cheerioDom('#content .container');
    const entryEl = containerEl.find('#detail .card-content');

    const labels = containerEl
      .find('.label')
      .map((i, el) => cheerioDom(el).text()?.trim().toLocaleLowerCase())
      .toArray()
      .filter(Boolean);

    const offerUrl = url ?? null;
    const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

    const basicFields = jobDetailPageActions.extractJobDetailBasicInfo(cheerioDom, entryEl);
    const salaryFields = jobDetailPageActions.extractJobDetailSalary(entryEl);
    const descriptionFields = jobDetailPageActions.extractJobDetailDescriptionInfo(cheerioDom, entryEl); // prettier-ignore
    const categFields = jobDetailPageActions.extractJobDetailCategories(cheerioDom, entryEl);

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

  extractJobDetailSalary: (entryEl?: Cheerio<AnyNode>): ProfesiaSkJobOfferSalaryFields => {
    const salaryText = entryEl?.find('.salary-range')?.text()?.trim() ?? null;
    // Try to parse texts like "Od 6,5 EUR/hod."
    let parsedSalary = salaryText?.match(/^[a-z]*\s*(?<lowVal>[\d, ]+)\s*(?<curr>[\w\p{L}\p{M}\p{Zs}]+)\/(?<period>\w+)/iu); // prettier-ignore
    // Try to parse texts like "35 000 - 45 000 Kč/mesiac"
    if (!parsedSalary) parsedSalary = salaryText?.match(/^(?<lowVal>[\d,. ]+)\s*-\s*(?<upVal>[\d,. ]+)(?<curr>[\w\p{L}\p{M}\p{Zs}]+)\/(?<period>\w+)/iu); // prettier-ignore

    const { groups } = parsedSalary || { groups: { lowVal: '', upVal: '', curr: '', period: '' } }; // prettier-ignore
    const {
      lowVal: salaryRangeLower,
      upVal: salaryRangeUpper,
      curr: salaryCurrency,
      period: salaryPeriod,
    } = groups || {};

    return {
      salaryRange: salaryText ?? null,
      salaryRangeLower: salaryRangeLower != null ? Number.parseInt(salaryRangeLower.replace(/\s/g, '')) : null, // prettier-ignore
      salaryRangeUpper: salaryRangeUpper != null ? Number.parseInt(salaryRangeUpper.replace(/\s/g, '')) : null, // prettier-ignore
      salaryCurrency,
      salaryPeriod,
    };
  },

  extractJobDetailBasicInfo: (cheerioDom: CheerioAPI, entryEl?: Cheerio<AnyNode>) => {
    const offerName = entryEl?.find('[itemprop="title"]')?.first().text()?.trim() ?? null;

    const employerName = entryEl?.find('[itemprop="hiringOrganization"]')?.first().text()?.trim() ?? null; // prettier-ignore
    const employerUrl = entryEl?.find('.easy-design-btn-offer-list')?.first().prop('href') ?? null; // prettier-ignore
    const employerLogoUrl = entryEl?.find('.easy-design-logo img')?.first().prop('src') ?? null; // prettier-ignore

    const employmentTypesText = entryEl?.find('[itemprop="employmentType"]')?.first().text()?.trim() ?? null; // prettier-ignore
    const employmentTypes = Object.entries(employmentTypeInfo).reduce<EmploymentType[]>((agg, [key, { text }]) => {
      if (employmentTypesText?.includes(text)) agg.push(key as EmploymentType);
      return agg;
    }, []); // prettier-ignore

    const startDate = entryEl?.find('.panel-body > .row:nth-child(2) > div:nth-child(1) span')?.first().text()?.trim() ?? null; // prettier-ignore
    const location = entryEl?.find('[itemprop="jobLocation"]')?.first().text()?.trim() ?? null; // prettier-ignore

    const phoneNumbers =
      entryEl
        ?.find('.details-section .tel')
        .map((i, el) => cheerioDom(el).text()?.trim())
        .toArray()
        .filter(Boolean) ?? [];

    const datePosted = entryEl?.find('[itemprop="datePosted"]')?.first().text()?.trim() ?? null; // prettier-ignore

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

  extractJobDetailDescriptionInfo: (cheerioDom: CheerioAPI, entryEl?: Cheerio<AnyNode>) => {
    const descriptionInfo = descriptionSections.reduce<ProfesiaSkJobOfferDescriptionFields>(
      (agg, { subsections, selector }) => {
        const sectionEl = entryEl?.find(selector).first();
        sectionEl?.find('.subtitle-line')?.remove();

        const sectionEls = sectionEl?.children().toArray().map((el) => cheerioDom(el)); // prettier-ignore
        chunk(sectionEls, 2).forEach(([titleEl, contentEl]) => {
          const titleText = titleEl.text()?.trim().toLocaleLowerCase();

          for (const [subsection, fragments] of Object.entries(subsections)) {
            if (fragments.some((text: string) => titleText?.includes(text))) {
              contentEl.find('.text-gray').remove();
              const key = subsection as keyof ProfesiaSkJobOfferDescriptionFields;
              agg[key] = contentEl.text()?.trim() ?? null; // prettier-ignore
            }
          }
        });
        return agg;
      },
      {} as any
    );

    return descriptionInfo;
  },

  extractJobDetailCategories: (cheerioDom: CheerioAPI, entryEl?: Cheerio<AnyNode>) => {
    const locationCategs: JobOfferCategoryItem[] = [];
    const positionCategs: JobOfferCategoryItem[] = [];

    let currHeading: string;
    // prettier-ignore
    entryEl?.find('.overall-info .hidden-xs')?.first().children().toArray().forEach((el) => {
      const chEl = cheerioDom(el);
      if (el.tagName === 'STRONG') {
        currHeading = chEl?.text()?.trim().toLocaleLowerCase() || '';
        return;
      }
      if (el.tagName === 'A' && currHeading.includes('lokalit')) {
        locationCategs.push({
          url: chEl.prop('href') ?? null,
          name: chEl.text()?.trim() ?? null,
        });
      }
      if (el.tagName === 'A' && currHeading.includes('pozícia')) {
        positionCategs.push({
          url: chEl.prop('href') ?? null,
          name: chEl.text()?.trim() ?? null,
        });
      }
    });

    return { locationCategs, positionCategs };
  },
};
