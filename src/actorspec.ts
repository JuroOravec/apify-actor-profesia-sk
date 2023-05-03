import type { DatasetFeatures, DatasetModes, DatasetOutput } from 'actor-spec';
import type { ApifyScraperActorSpec, WithActorEntryMetadata } from 'apify-actor-utils';
import { fromPairs } from 'lodash';

import { DetailedProfesiaSKJobOfferItem, SimpleProfesiaSKJobOfferItem } from './types';

type JobOfferDetailedFields = Exclude<keyof DetailedProfesiaSKJobOfferItem, keyof SimpleProfesiaSKJobOfferItem>; // prettier-ignore
const jobOfferDetailedField: JobOfferDetailedFields[] = [
  'employmentTypes',
  'startDate',
  'phoneNumbers',
  'datePosted',
  'locationCategs',
  'professionCategs',
  'jobInfoResponsibilities',
  'jobInfoBenefits',
  'jobInfoDeadline',
  'jobReqEducation',
  'jobReqExpertise',
  'jobReqLanguage',
  'jobReqOther',
  'jobReqDriversLicense',
  'jobReqIndustry',
  'jobReqSuitableForGraduate',
  'jobReqPersonalSkills',
  'employerDescription',
  'employeeCount',
  'employerContact',
];

const filters = [
  'Keyword(s) (full-text search)',
  'Minimum salary (per month / per hour)',
  'Employment type (full-time, part-time, freelance, internship, voluntary)',
  'Remote status (remote, partial, on-site)',
  'Job offer age (in days)',
];

const modes = [
  { name: 'fast', isDefault: true, shortDesc: 'data taken from listing page only' },
  { name: 'detailed', isDefault: false, shortDesc: 'visit each job offer page' },
] satisfies DatasetModes[];

const datasetFeatures = {
  usesBrowser: false,
  proxySupport: true,
  configurable: true,
  regularlyTested: true,
  privacyCompliance: true,
  errorMonitoring: true,
} satisfies DatasetFeatures;

const actorId = 'profesia-sk-scraper';
const authorId = 'jurooravec';

const actorSpec = {
  actorspecVersion: 1,
  actor: {
    title: 'Profesia.sk Scraper',
    publicUrl: `https://apify.com/${authorId}/${actorId}`,
    shortDesc:
      'One-stop-shop for all data on Profesia.sk. Extract job offers, list of companies, professions, locations... Job offers include salary, textual info, company, and more.',
    datasetOverviewImgUrl: './public/imgs/profesia-sk-actor-dataset-overview1.png',
  },
  platform: {
    name: 'apify',
    url: 'https://apify.com',
    authorId,
    authorProfileUrl: `https://apify.com/${authorId}`,
    actorId,
    socials: {
      discord: 'https://discord.com/channels/801163717915574323',
    },
  },
  authors: [
    {
      name: 'Juro Oravec',
      email: 'juraj.oravec.josefson@gmail.com',
      authorUrl: 'https://jurora.vc',
    },
  ],
  websites: [
    {
      name: 'Profesia.sk',
      url: 'https://www.profesia.sk',
    },
  ],
  pricing: {
    pricingType: 'monthly fee',
    value: 25,
    currency: 'eur',
    period: 1,
    periodUnit: 'month',
  },
  datasets: [
    {
      name: 'jobOffers',
      shortDesc: 'Job offers',
      url: 'https://profesia.sk/praca',
      size: 21000,
      isDefault: true,
      filters,
      modes,
      features: datasetFeatures,
      privacy: {
        personalDataFields: ['employerContact', 'phoneNumbers'],
        isPersonalDataRedacted: true,
        personalDataSubjects: ['employees'],
      },
      perfTable: 'jobOffers',
      // prettier-ignore
      perfStats: [
        { rowId: 'fast', colId: '1000items', mode: 'fast', count: 1000, costUsd: 0.023, timeSec: 52 },
        { rowId: 'fast', colId: 'fullRun', mode: 'fast', count: 'all', costUsd: 0.482, timeSec: 1092 },
        { rowId: 'detailed', colId: '1000items', mode: 'detailed', count: 1000, costUsd: 0.042, timeSec: 104 },
        { rowId: 'detailed', colId: 'fullRun', mode: 'detailed', count: 'all', costUsd: 0.870, timeSec: 2190 },
      ],
      output: {
        exampleEntry: {
          listingUrl: 'https://www.profesia.sk/praca/?page_num=5',
          employerName: null,
          employerUrl: 'https://www.profesia.sk/praca/prva-stavebna-sporitelna/C11358?page_num=5',
          employerLogoUrl:
            'https://www.profesia.sk/customdesigns/EasyDesign/1/292/images/11358/logo.png?page_num=5',
          offerName: null,
          offerUrl: 'https://www.profesia.sk/praca/prva-stavebna-sporitelna/O4563553?page_num=5',
          offerId: 'O4563553',
          location: 'Stará Ľubovňa',
          labels: [],
          lastChangeRelativeTime: 'pred 11 hodinami',
          lastChangeType: 'added',
          salaryRange: '2 000 EUR/mesiac',
          salaryRangeLower: 2000,
          salaryRangeUpper: null,
          salaryCurrency: 'eur',
          salaryPeriod: 'month',
          employmentTypes: ['selfemploy'],
          startDate: 'Dohodou',
          phoneNumbers: ['+421123456789'],
          datePosted: '2023-04-22',
          jobInfoDeadline: null,
          jobInfoResponsibilities:
            'Ponúkame pracovné miesta v Starej Ľubovni, Kežmarku a v Spišskej Belej.Sme úspešná firma, plná úspešných ľudí!Chcete zažiť úspech? Ste tu správne! Sme PSS, Prvá stavebná sporiteľňa, s najvyšším podielom na trhu a zaradili sme sa do rebríčka TOP 3 finančných inštitúcií poskytujúcich produkty na financovanie bývania.Pridajte sa k nám a naučíme Vás, ako sa stať expertom na financovanie bývania.Čo bude Vaša úloha v tíme na pozícii obchodný zástupca:spravovať klientske portfólio PSSsamostatne viesť obchodné rokovaniavyhľadávať nových klientovaktívne hľadať a ponúkať klientom riešenia v oblasti financovania bývaniarealizovať obchodné ciele v oblasti sprostredkovania predaja produktov PSSbudovať tímovú spoluprácu',
          jobInfoBenefits:
            'Čo ponúkame:komplexné portfólio produktovstabilné pracovné miesto – kancelária, notebook, databáza klientovadministratívnu a právnu podporubezplatnú certifikáciu v NBSodborné vzdelávanie a  školenia na rozvoj obchodného potenciáluatraktívnu províznu schému, motivačné súťaže, TOP klubyteambuildingypodporu pre začínajúcich obchodných zástupcov – finančná podpora, mentorvideoporadenstvo – online komunikácia s klientombezplatnú marketingovú podporuflexibilný pracovný časprácu na živnosť alebo ako právnická osoba',
          jobReqEducation:
            'stredoškolské s maturitou\nnadstavbové/vyššie odborné vzdelanie\nvysokoškolské I. stupňa\nvysokoškolské II. stupňa\nvysokoškolské III. stupňa',
          jobReqIndustry:
            'stredoškolské s maturitou\nnadstavbové/vyššie odborné vzdelanie\nvysokoškolské I. stupňa\nvysokoškolské II. stupňa\nvysokoškolské III. stupňa',
          jobReqOther: 'Microsoft Word - ZákladyMicrosoft Excel - Základy',
          jobReqSuitableForGraduate: 'Áno',
          jobReqPersonalSkills:
            'Čím nás oslovíte:ste ľudský, empatický, sebavedomý, svedomitýmáte príjemné vystupovaniemáte obchodného duchachcete na sebe neustále pracovať a rozvíjať saviete pracovať samostatne, ale rozumiete dôležitosti tímovej spolupráceuž teraz sa tešíte na stretnutia s klientommáte minimálne SŠ vzdelanie s maturitou',
          jobReqExpertise: null,
          jobReqLanguage: null,
          jobReqDriversLicense: null,
          employerDescription:
            'Sme experti na financovanie bývania a na trhu pôsobíme už 30 rokov. Naše produkty využilo viac ako 2,5 milióna klientov, ktorým sme pomohli splniť si sen o vlastnom bývaní.\n\nZastávame hodnoty, ktoré zabezpečujú férový prístup ku klientom a aj k našim kolegom. Naše úspechy sú výsledkom tímovej spolupráce a práce kolegov motivovaných pestrým benefitným programom a adekvátnym finančným ohodnotením.\n\nAk sa chcete stať súčasťou tímu centrály PSS a nenašli ste pozíciu, ktorá by Vás oslovila, určite nám napíšte na [email protected] \nV prípade záujmu o prácu obchodného zástupcu v regióne, ktorý aktuálne nemá aktívnu inzerciu, prihláste sa prosím na nasledujúcom linku a uveďte svoje kontaktné údaje:\nhttps://ats.nalgoo.com/sk/gate/fopss/position/65267/\n\nNaši kolegovia sa Vám ozvú a preberú s Vami aktuálne možnosti, pretože v PSS si vážime každý jeden talent a vieme oceniť prínos každého kolegu!',
          employeeCount: '250-499 zamestnancov',
          employerContact:
            'Kontaktná osoba: Ing. Name RedactedTel.: +421123456789-mail: poslať životopis',
          locationCategs: [
            {
              url: 'https://www.profesia.sk/praca/stara-lubovna/?page_num=5',
              name: 'Stará Ľubovňa',
            },
          ],
          professionCategs: [
            {
              url: 'https://www.profesia.sk/praca/klientsky-pracovnik/?page_num=5',
              name: 'Klientský pracovník',
            },
            {
              url: 'https://www.profesia.sk/praca/obchodny-zastupca/?page_num=5',
              name: 'Obchodný zástupca',
            },
          ],
          metadata: {
            actorId: 'xLwYqj7sxMcGRcYZt',
            actorRunId: 'TzHJ97DLccjt41Vjf',
            actorRunUrl:
              'https://console.apify.com/actors/xLwYqj7sxMcGRcYZt/runs/TzHJ97DLccjt41Vjf',
            contextId: 'Zj3uHMtLtq',
            requestId: 'Q1E7YC5MfacPnSa',
            originalUrl: 'https://www.profesia.sk/praca/?page_num=5',
            loadedUrl: 'https://www.profesia.sk/praca/?page_num=5',
            dateHandled: '2023-04-22T17:42:14.677Z',
            numberOfRetries: 0,
          },
        },
        exampleEntryComments: fromPairs(
          jobOfferDetailedField.map((f) => [f, 'Only in detailed entry'])
        ) as Record<JobOfferDetailedFields, string>,
      } satisfies DatasetOutput<WithActorEntryMetadata<DetailedProfesiaSKJobOfferItem>>,
    },
    {
      name: 'companies',
      shortDesc: 'List of companies that have job offers',
      url: 'https://www.profesia.sk/praca/zoznam-spolocnosti',
      size: 21000, // TODO
      isDefault: false,
      filters: [],
      modes: [],
      features: datasetFeatures,
      privacy: {
        personalDataFields: [],
        isPersonalDataRedacted: true,
        personalDataSubjects: [],
      },
      perfTable: 'other',
      perfStats: [], // TODO
    },
    {
      name: 'industries',
      shortDesc: 'List of industries that have job offers',
      url: 'https://www.profesia.sk/praca/zoznam-pracovnych-oblasti',
      size: 21000, // TODO
      isDefault: false,
      filters: [],
      modes: [],
      features: datasetFeatures,
      privacy: {
        personalDataFields: [],
        isPersonalDataRedacted: true,
        personalDataSubjects: [],
      },
      perfTable: 'other',
      perfStats: [], // TODO
    },
    {
      name: 'locations',
      shortDesc: 'List of locations that have job offers',
      url: 'https://www.profesia.sk/praca/zoznam-lokalit',
      size: 21000, // TODO
      isDefault: false,
      filters: [],
      modes: [],
      features: datasetFeatures,
      privacy: {
        personalDataFields: [],
        isPersonalDataRedacted: true,
        personalDataSubjects: [],
      },
      perfTable: 'other',
      perfStats: [], // TODO
    },
    {
      name: 'professions',
      shortDesc: 'List of professions',
      url: 'https://www.profesia.sk/praca/zoznam-pozicii',
      size: 21000, // TODO
      isDefault: false,
      filters: [],
      modes: [],
      features: datasetFeatures,
      privacy: {
        personalDataFields: [],
        isPersonalDataRedacted: true,
        personalDataSubjects: [],
      },
      perfTable: 'other',
      perfStats: [], // TODO
    },
    {
      name: 'languages',
      shortDesc: 'List of advertised language requirements',
      url: 'https://www.profesia.sk/praca/zoznam-pozicii',
      size: 21000, // TODO
      isDefault: false,
      filters: [],
      modes: [],
      features: datasetFeatures,
      privacy: {
        personalDataFields: [],
        isPersonalDataRedacted: true,
        personalDataSubjects: [],
      },
      perfTable: 'other',
      perfStats: [], // TODO
    },
    {
      name: 'partners',
      shortDesc: 'List of partners of profesia.sk',
      url: 'https://profesia.sk/partneri',
      size: 21000, // TODO
      isDefault: false,
      filters: [],
      modes: [],
      features: datasetFeatures,
      privacy: {
        personalDataFields: [],
        isPersonalDataRedacted: true,
        personalDataSubjects: [],
      },
      perfTable: 'other',
      perfStats: [], // TODO
    },
  ] as any,
} satisfies ApifyScraperActorSpec;

export default actorSpec;
