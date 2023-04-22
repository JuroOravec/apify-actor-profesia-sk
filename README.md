Profesia.sk Scraper
===============================

One-stop-shop for all data on Profesia.sk. Extract job offers, list of companies, professions, locations... Job offers include salary, textual info, company, and more.

## What is Profesia.sk Scraper and how does it work?

With Profesia.sk Scraper, you can extract:
- [Job offers](https://profesia.sk/praca)
- [List of companies that have job offers](https://www.profesia.sk/praca/zoznam-spolocnosti)
- [List of industries that have job offers](https://www.profesia.sk/praca/zoznam-pracovnych-oblasti)
- [List of locations that have job offers](https://www.profesia.sk/praca/zoznam-lokalit)
- [List of professions](https://www.profesia.sk/praca/zoznam-pozicii)
- [List of advertised language requirements](https://www.profesia.sk/praca/zoznam-pozicii)
- [List of partners of profesia.sk](https://profesia.sk/partneri)

See [outputs section](#outputs) for detailed decription.

The data can be downloaded in JSON, JSONL, XML, CSV, Excel, or HTML formats.

## Features
- **7 kinds of datasets**
  - Scrape details of job offers (or other datasets) or 6 other kinds of datasets.
- **Fast vs Detailed modes**
  - Job offer scraping can be either quick & simple (data taken from listing page only) or detailed (visit each job offer page)
- **Full filter support**
  - Filter the results by search terms, minimum salary, employment type, remote work status, or age of the job offer.
  - Custom filters can be set up by providing URL to the job listing page with the filters applied.
  - Limit the number of results
- **Blazing fast**
  - The actor doesn't use browser to extract the data, which means it's fast and cheap.
- **Custom crawler configuration**
  - For advanced needs, you can pass Crawler configuration via Input.
- **Tested daily for highly reliability**
  - The actor is regularly tested end-to-end to minimize the risk of a broken integration.
- **Error handling**
  - Errors are captured and surfaced in the `REPORTING` dataset. (See Storage > Dataset > Select dropdown)

## How can you use scraped Profesia.sk data? (Examples)

Companies
  - Analyse competitors' job offers and recruitment strategies.
  - Create competitive salary packages + perks based on the information like salary or remote options.
  - Analyze the effectiveness of job advertisements and optimize their recruitment marketing strategies.

Recruiters
  - Automate the process of finding job offers for your clients.

Analysists
  - Analyze job market trends like salary expectations, popular job types, and in-demand skills.
  - Study the regional job market trends.

## How to use Profesia.sk Scraper
1. Create a free Apify account using your email
2. Open Profesia.sk Scraper
3. In Input, select the dataset to scrape, filters to apply.
4. Click "Start" and wait for the data to be extracted.
5. Download your data in JSON, JSONL, XML, CSV, Excel, or HTML format.

For details and examples for all input fields, please visit the [Input tab](https://apify.com/jurooravec/apify-store-scraper/input-schema).

## How much does it cost to scrape Profesia.sk?

### Job offers

<table>
  <thead>
    <tr>
      <td></td>
      <td><strong>1000 results</strong></td>
      <td><strong>Full run (~21k) results</strong></td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Fast run</td>
      <td>$0.023 in 52s</td>
      <td>$0.482 in 18m 12s</td>
    </tr>
    <tr>
      <td>Detailed run</td>
      <td>$0.042 in 1m 44s</td>
      <td>$0.870 in 36m 30s</td>
    </tr>
  </tbody>
</table>

<br/>
Checking for new job offers every day => costs less than $1 per month ($0.713 = 31 * $0.023).

Remember that with the [Apify Free plan](https://apify.com/pricing) you have $5 free usage per month.

### Other datasets

List of companies, professions, locations, industries, partners, etc, are all around $0.038 (24s) per run.

## Input options

For details and examples for all input fields, please visit the [Input tab](https://apify.com/jurooravec/apify-store-scraper/input-schema).

### Filter options

You can run Profesia.sk Scraper as is, with the default options. This will get you the full list of all job offers (detailed version).

Otherwise, you can set these filters:

- Keyword(s) (full-text search)
- Minimum salary (per month / per hour)
- minimum salary (per month / per hour)
- Employment type (full-time, part-time, freelance, internship, voluntary)
- Remote status (remote, partial, on-site)
- Job offer age (in days)

Alternatively, you can set up [a custom search filter](https://www.profesia.sk/search_offers.php), and pass the resulting [search results URL](https://www.profesia.sk/praca/skrateny-uvazok/?count_days=1&positions[]=40&salary=1000&salary_period=m&skills[]=73_15_5_12) to the `startUrls` input option.

Hence you can e.g. use Profesia.sk Scraper to dynamically check for existence of certain job offers.

### Input examples

#### Example 1: Get summary of all job offers in last 20 days for full-time on-site cooks with salary 6+ eur/hr

```json
{
  "datasetType": "jobOffers",
  "jobOfferFilterEmploymentType": "fte",
  "jobOfferFilterLastNDays": 20,
  "jobOfferFilterMinSalaryPeriod": "hour",
  "jobOfferFilterMinSalaryValue": 6,
  "jobOfferFilterQuery": "kuchar",
  "jobOfferFilterRemoteWorkType": "noRemote",
}
```

#### Example 2: Same as above, but specified by providing a custom search results URL

```json
{
  "startUrls": ["https://www.profesia.sk/praca/kuchar/plny-uvazok/?count_days=20&remote_work=0&salary=6&salary_period=h"]
}
```

#### Example 3: (Advanced) Same as above, but re-configure the crawler to increase the request timeout to 5 min and request retries to 5

```json
{
  "startUrls": ["https://www.profesia.sk/praca/kuchar/plny-uvazok/?count_days=20&remote_work=0&salary=6&salary_period=h"],
  "requestHandlerTimeoutSecs": 300,
  "maxRequestRetries": 5
}
```

## Outputs

Once the actor is done, you can see the overview of results in the Output tab.

To export the data, head over to the Storage tab.

![Profesia.sk Actor dataset overview](./public/imgs/profesia-sk-actor-dataset-overview1.png)

## Sample output from Profesia.sk Scraper

### Job offer

```json
{
  "listingUrl": "https://www.profesia.sk/praca/?page_num=5",
  "employerName": null,
  "employerUrl": "https://www.profesia.sk/praca/prva-stavebna-sporitelna/C11358?page_num=5",
  "employerLogoUrl": "https://www.profesia.sk/customdesigns/EasyDesign/1/292/images/11358/logo.png?page_num=5",
  "offerName": null,
  "offerUrl": "https://www.profesia.sk/praca/prva-stavebna-sporitelna/O4563553?page_num=5",
  "offerId": "O4563553",
  "location": "Stará Ľubovňa",
  "labels": [],
  "lastChangeRelativeTime": "pred 11 hodinami",
  "lastChangeType": "added",
  "salaryRange": "2 000 EUR/mesiac",
  "salaryRangeLower": 2000,
  "salaryRangeUpper": null,
  "salaryCurrency": "eur",
  "salaryPeriod": "month",
  "employmentTypes": [
    "selfemploy"
  ],
  "startDate": "Dohodou",
  "phoneNumbers": [
    "+421123456789"
  ],
  "datePosted": "2023-04-22",
  "jobInfoResponsibilities": "Ponúkame pracovné miesta v Starej Ľubovni, Kežmarku a v Spišskej Belej.Sme úspešná firma, plná úspešných ľudí!Chcete zažiť úspech? Ste tu správne! Sme PSS, Prvá stavebná sporiteľňa, s najvyšším podielom na trhu a zaradili sme sa do rebríčka TOP 3 finančných inštitúcií poskytujúcich produkty na financovanie bývania.Pridajte sa k nám a naučíme Vás, ako sa stať expertom na financovanie bývania.Čo bude Vaša úloha v tíme na pozícii obchodný zástupca:spravovať klientske portfólio PSSsamostatne viesť obchodné rokovaniavyhľadávať nových klientovaktívne hľadať a ponúkať klientom riešenia v oblasti financovania bývaniarealizovať obchodné ciele v oblasti sprostredkovania predaja produktov PSSbudovať tímovú spoluprácu",
  "jobInfoBenefits": "Čo ponúkame:komplexné portfólio produktovstabilné pracovné miesto – kancelária, notebook, databáza klientovadministratívnu a právnu podporubezplatnú certifikáciu v NBSodborné vzdelávanie a  školenia na rozvoj obchodného potenciáluatraktívnu províznu schému, motivačné súťaže, TOP klubyteambuildingypodporu pre začínajúcich obchodných zástupcov – finančná podpora, mentorvideoporadenstvo – online komunikácia s klientombezplatnú marketingovú podporuflexibilný pracovný časprácu na živnosť alebo ako právnická osoba",
  "jobReqEducation": "stredoškolské s maturitou\nnadstavbové/vyššie odborné vzdelanie\nvysokoškolské I. stupňa\nvysokoškolské II. stupňa\nvysokoškolské III. stupňa",
  "jobReqIndustry": "stredoškolské s maturitou\nnadstavbové/vyššie odborné vzdelanie\nvysokoškolské I. stupňa\nvysokoškolské II. stupňa\nvysokoškolské III. stupňa",
  "jobReqOther": "Microsoft Word - ZákladyMicrosoft Excel - Základy",
  "jobReqSuitableForGraduate": "Áno",
  "jobReqPersonalSkills": "Čím nás oslovíte:ste ľudský, empatický, sebavedomý, svedomitýmáte príjemné vystupovaniemáte obchodného duchachcete na sebe neustále pracovať a rozvíjať saviete pracovať samostatne, ale rozumiete dôležitosti tímovej spolupráceuž teraz sa tešíte na stretnutia s klientommáte minimálne SŠ vzdelanie s maturitou",
  "employerDescription": "Sme experti na financovanie bývania a na trhu pôsobíme už 30 rokov. Naše produkty využilo viac ako 2,5 milióna klientov, ktorým sme pomohli splniť si sen o vlastnom bývaní.\n\nZastávame hodnoty, ktoré zabezpečujú férový prístup ku klientom a aj k našim kolegom. Naše úspechy sú výsledkom tímovej spolupráce a práce kolegov motivovaných pestrým benefitným programom a adekvátnym finančným ohodnotením.\n\nAk sa chcete stať súčasťou tímu centrály PSS a nenašli ste pozíciu, ktorá by Vás oslovila, určite nám napíšte na [email protected] \nV prípade záujmu o prácu obchodného zástupcu v regióne, ktorý aktuálne nemá aktívnu inzerciu, prihláste sa prosím na nasledujúcom linku a uveďte svoje kontaktné údaje:\nhttps://ats.nalgoo.com/sk/gate/fopss/position/65267/\n\nNaši kolegovia sa Vám ozvú a preberú s Vami aktuálne možnosti, pretože v PSS si vážime každý jeden talent a vieme oceniť prínos každého kolegu!",
  "employeeCount": "250-499 zamestnancov",
  "employerContact": "Kontaktná osoba: Ing. Name RedactedTel.: +421123456789-mail: poslať životopis",
  "locationCategs": [
    {
      "url": "https://www.profesia.sk/praca/stara-lubovna/?page_num=5",
      "name": "Stará Ľubovňa"
    }
  ],
  "professionCategs": [
    {
      "url": "https://www.profesia.sk/praca/klientsky-pracovnik/?page_num=5",
      "name": "Klientský pracovník"
    },
    {
      "url": "https://www.profesia.sk/praca/obchodny-zastupca/?page_num=5",
      "name": "Obchodný zástupca"
    }
  ],
  "metadata": {
    "actorId": "xLwYqj7sxMcGRcYZt",
    "actorRunId": "TzHJ97DLccjt41Vjf",
    "actorRunUrl": "https://console.apify.com/actors/xLwYqj7sxMcGRcYZt/runs/TzHJ97DLccjt41Vjf",
    "contextId": "Zj3uHMtLtq",
    "requestId": "Q1E7YC5MfacPnSa",
    "originalUrl": "https://www.profesia.sk/praca/?page_num=5",
    "loadedUrl": "https://www.profesia.sk/praca/?page_num=5",
    "dateHandled": "2023-04-22T17:42:14.677Z",
    "numberOfRetries": 0
  }
}
```

### Companies, professions, industries, languages list

```json
{
  "url": "https://www.profesia.sk/praca/-hola-akademia/C255259",
  "name": "!Hola! akadémia s.r.o.",
  "count": 1,
  "metadata": {
    "actorId": "xLwYqj7sxMcGRcYZt",
    "actorRunId": "vQ5k8aXbwTROahMeK",
    "actorRunUrl": "https://console.apify.com/actors/xLwYqj7sxMcGRcYZt/runs/vQ5k8aXbwTROahMeK",
    "contextId": "bMlblASmeT",
    "requestId": "RlmnlCkaYRPDswZ",
    "originalUrl": "https://www.profesia.sk/praca/zoznam-spolocnosti",
    "loadedUrl": "https://www.profesia.sk/praca/zoznam-spolocnosti/",
    "dateHandled": "2023-04-22T18:05:38.248Z",
    "numberOfRetries": 0
  }
}
```

### Locations list

```json
{
  "url": "https://www.profesia.sk/praca/bratislavsky-kraj/",
  "name": "Bratislavský kraj",
  "count": 7890,
  "region": "Bratislavský kraj",
  "country": "Slovenská republika",
  "metadata": {
    "actorId": "xLwYqj7sxMcGRcYZt",
    "actorRunId": "8qwRsXGUZsxlZjRDK",
    "actorRunUrl": "https://console.apify.com/actors/xLwYqj7sxMcGRcYZt/runs/8qwRsXGUZsxlZjRDK",
    "contextId": "eEJHPCqmT5",
    "requestId": "1k0DgwIuJ2QoZ3D",
    "originalUrl": "https://www.profesia.sk/praca/zoznam-lokalit",
    "loadedUrl": "https://www.profesia.sk/praca/zoznam-lokalit/",
    "dateHandled": "2023-04-22T19:33:23.110Z",
    "numberOfRetries": 0
  }
}
```

### Partners list

```json
{
  "name": "Absolventi.STUBA.SK",
  "url": "http://www.absolventi.stuba.sk/",
  "description": "Je určený všetkým absolventom, študentom, priateľom i priaznivcom STU v Bratislave. Jeho prostredníctvom môžete získať informácie o aktuálnom dianí, či hľadať medzi našimi čerstvými absolventmi perspektívnych zamestnancov pre svoje firmy. Práce na portáli a jeho definitívnej podobe ešte stále pokračujú.",
  "logoUrl": "https://www.profesia.sk/images/partner_logos/stuba_90x37.png",
  "category": "Špecializované servery",
  "metadata": {
    "actorId": "xLwYqj7sxMcGRcYZt",
    "actorRunId": "pdXzgtjmuOsJw2U2M",
    "actorRunUrl": "https://console.apify.com/actors/xLwYqj7sxMcGRcYZt/runs/pdXzgtjmuOsJw2U2M",
    "contextId": "rVPpH6Bam1",
    "requestId": "6DUFNu05KLfFoVN",
    "originalUrl": "https://www.profesia.sk/partneri",
    "loadedUrl": "https://www.profesia.sk/partneri",
    "dateHandled": "2023-04-22T19:34:44.968Z",
    "numberOfRetries": 1
  }
}
```

## How to integrate Profesia.sk Scraper with other services, APIs or Actors
You can connect the actor with many of the [integrations on the Apify platform](https://apify.com/integrations). You can integrate with Make, Zapier, Slack, Airbyte, GitHub, Google Sheets, Google Drive, [and more](https://docs.apify.com/integrations). Or you can use [webhooks](https://docs.apify.com/integrations/webhooks) to carry out an action whenever an event occurs, e.g. get a notification whenever Instagram API Scraper successfully finishes a run.

## Use Profesia.sk actor with Apify API
The Apify API gives you programmatic access to the Apify platform. The API is organized around RESTful HTTP endpoints that enable you to manage, schedule and run Apify actors. The API also lets you access any datasets, monitor actor performance, fetch results, create and update versions, and more.

To access the API using Node.js, use the `apify-client` NPM package. To access the API using Python, use the `apify-client` PyPI package.

Check out the [Apify API reference](https://docs.apify.com/api/v2) docs for full details or click on the [API tab](https://apify.com/jurooravec/apify-store-scraper/api) for code examples.

## Is it legal to scrape Profesia.sk?
It is legal to scrape publicly available data such as product descriptions, prices, or ratings. Read Apify's blog post on [the legality of web scraping](https://blog.apify.com/is-web-scraping-legal/) to learn more.

## Who can I contact for issues with Profesia.sk actor?
To report issues and find help, head over to the [Discord community](https://discord.com/channels/801163717915574323).
