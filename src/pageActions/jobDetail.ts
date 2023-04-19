import type { Page } from 'playwright';
import type { Log } from 'apify';

import type {
  EmploymentType,
  DetailedProfesiaSKJobOfferItem,
  ProfesiaSkJobOfferDescriptionFields,
  SimpleProfesiaSKJobOfferItem,
  JobOfferCategoryItem,
} from '../types';
import type { MaybePromise } from '../utils/types';

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
  extractJobDetail: async ({
    page,
    log,
    onData,
    jobData,
  }: {
    page: Page;
    log: Log;
    onData: (data: DetailedProfesiaSKJobOfferItem[]) => MaybePromise<void>;
    /**
     * In case we've come across this job ad on a listing page, we pass it here
     * in case there's some data that was available then which is not here */
    jobData?: SimpleProfesiaSKJobOfferItem;
  }) => {
    log.info(`Extracting job details from the page`);
    const entry = await page.locator('#content .container').evaluate(
      // prettier-ignore
      (containerEl, { descSections, jobData, employmentTypeInfo }): DetailedProfesiaSKJobOfferItem => {
        const labels = [...containerEl.querySelectorAll('label')]
          .map((el) => el.textContent?.trim().toLocaleLowerCase())
          .filter(Boolean) as string[];

        const entryEl = containerEl.querySelector('#detail .card-content');

        const offerName = entryEl?.querySelector('[itemprop="title"]')?.textContent?.trim() ?? null;
        const offerUrl = window.location.href;
        const offerId = offerUrl?.match(/O\d{2,}/)?.[0] ?? null;

        const employerName = entryEl?.querySelector('[itemprop="hiringOrganization"]')?.textContent?.trim() ?? null; // prettier-ignore
        const employerUrl = entryEl?.querySelector<HTMLAnchorElement>('.easy-design-btn-offer-list')?.href ?? null; // prettier-ignore
        const employerLogoUrl = entryEl?.querySelector<HTMLImageElement>('.easy-design-logo img')?.src ?? null; // prettier-ignore

        const employmentTypesText = entryEl?.querySelector('[itemprop="employmentType"]')?.textContent?.trim() ?? null; // prettier-ignore
        const employmentTypes = Object.entries(employmentTypeInfo).reduce<EmploymentType[]>((agg, [key, { text }]) => {
          if (employmentTypesText?.includes(text)) agg.push(key as EmploymentType);
          return agg;
        }, []); // prettier-ignore

        const startDate = entryEl?.querySelector('.panel-body > .row:nth-child(2) > div:nth-child(1) span')?.textContent?.trim() ?? null; // prettier-ignore
        const location = entryEl?.querySelector('[itemprop="jobLocation"]')?.textContent?.trim() ?? null; // prettier-ignore

        const salaryText = entryEl?.querySelector('.salary-range')?.textContent?.trim() ?? null;
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

        const chunk = <T>(arr: T[], chunkSize = 1, cache: T[][] = []) => {
          const tmp = [...arr]
          if (chunkSize <= 0) return cache
          while (tmp.length) cache.push(tmp.splice(0, chunkSize))
          return cache
        }

        const descriptionInfo = descSections.reduce<ProfesiaSkJobOfferDescriptionFields>(
          (agg, { subsections, selector }) => {
            const sectionEl = entryEl?.querySelector(selector);
            sectionEl?.querySelector('.subtitle-line')?.remove();

            chunk([...(sectionEl?.children || [])], 2).forEach(([titleEl, contentEl]) => {
              const titleText = titleEl.textContent?.trim().toLocaleLowerCase();

              for (const [subsection, fragments] of Object.entries(subsections)) {
                if (fragments.some((text: string) => titleText?.includes(text))) {
                  [...contentEl.querySelectorAll('.text-gray')].forEach((el) => el.remove());
                  agg[subsection as keyof ProfesiaSkJobOfferDescriptionFields] = contentEl.textContent?.trim() ?? null; // prettier-ignore
                }
              }
            });
            return agg;
          },
          {} as any
        );

        const phoneNumbers = [...(entryEl?.querySelectorAll('.details-section .tel') || [])]
          .map((el) => el.textContent?.trim())
          .filter(Boolean) as string[];

        const datePosted = entryEl?.querySelector('[itemprop="datePosted"]')?.textContent?.trim() ?? null; // prettier-ignore

        const locationCategs: JobOfferCategoryItem[] = [];
        const positionCategs: JobOfferCategoryItem[] = [];

        let currHeading: string;
        [...(entryEl?.querySelector('.overall-info .hidden-xs')?.children || [])].forEach((el) => {
          if (el.nodeName === 'STRONG') {
            currHeading = el.textContent?.trim().toLocaleLowerCase() || '';
            return;
          }
          if (el.nodeName === 'A' && currHeading.includes('lokalit')) {
            locationCategs.push({
              url: (el as HTMLAnchorElement).href ?? null,
              name: el.textContent?.trim() ?? null,
            });
          }
          if (el.nodeName === 'A' && currHeading.includes('pozícia')) {
            positionCategs.push({
              url: (el as HTMLAnchorElement).href ?? null,
              name: el.textContent?.trim() ?? null,
            });
          }
        });

        return {
          ...jobData, // Add the fields we've got from listing page

          listingUrl: jobData?.listingUrl ?? null,
          lastChangeRelativeTime: jobData?.lastChangeRelativeTime ?? null,
          lastChangeType: jobData?.lastChangeType ?? null,

          employerName,
          employerUrl,
          employerLogoUrl,

          offerName,
          offerUrl,
          offerId,

          salaryRange: salaryText ?? null,
          salaryRangeLower: salaryRangeLower != null ? Number.parseInt(salaryRangeLower.replace(/\s/g, '')) : null, // prettier-ignore
          salaryRangeUpper: salaryRangeUpper != null ? Number.parseInt(salaryRangeUpper.replace(/\s/g, '')) : null, // prettier-ignore
          salaryCurrency,
          salaryPeriod,

          location,
          labels,
          employmentTypes,
          startDate,
          phoneNumbers,
          datePosted,

          locationCategs,
          positionCategs,

          ...descriptionInfo,
        };
      },
      { descSections: descriptionSections, jobData, employmentTypeInfo }
    );

    log.info(`Done extracting job details from the page (ID: ${entry.offerId})`);

    log.info(`Calling callback with extracted job detail (ID: ${entry.offerId})`);
    await onData([entry]);
    log.info(`DONE calling callback with extracted job detail (ID: ${entry.offerId})`);
  },
};
