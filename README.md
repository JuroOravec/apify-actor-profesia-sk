# Profesia.sk Scraper

===============================

Apify actor scraper for profesia.sk

For more info see:

- <https://apify.com/jurooravec/profesia-sk-scraper>
- <https://github.com/JuroOravec/crawlee-one>
- <https://docs.apify.com/platform/actors/development>

## Checklist

1. Dataset identification

    - [ ] 1.1 Identify distinct types of web pages and the data of interest
    - [ ] 1.2 Identify how to distinguish between the web pages, whether via URL, or page content
    - [ ] 1.3 Define labels for these distinct types in `./router.ts`
    - [ ] 1.4 Define default handler matchers based on these distinct types in `./router.ts`
    - [ ] 1.5 Define these distinct types in `./router.ts`
    - [ ] 1.6 Identify the fields / data of interest per each page.
      - [ ] 1.6.1 Which fields are composite / will need post-processing? (e.g. more info packed up in single text)
      - [ ] 1.6.2 Which fields are considered personally identifiable information (GDPR)?
      - [ ] 1.6.3 For URLs, are they relative or absolute?
    - [ ] 1.7 Check if there isn't additional data either in HTML or requests (usually Fetch/XHR)

2. Entry extraction

    - [ ] 2.1 Check if you need browser / JS to make the data load
    - [ ] 2.2. Check if you need to click / trigger anything to make the data load
    - [ ] 2.3 Check if you need cookie session to make the data load
    - [ ] 2.4 Check if you need to be logged in to make the data load
    - [ ] 2.5 Check if the page differs if you visit it via incognito
    - [ ] 2.6 Check if entries have distinct URL

3. Entry scheduling / Listing

    - [ ] 2.0 How do I find the listing page(s), is it single or more pages? (remember how paperindex was structured)
    - [ ] 2.1 Check if you need browser / JS to make the listing load
    - [ ] 2.2 Check if you need to click / trigger anything to make the listing load
    - [ ] 2.3 Check if you need cookie session to make the listing load
    - [ ] 2.4 Check if you need to be logged in to make the listing load
    - [ ] 2.5 Check if the page differs if you visit it via incognito
    - [ ] 2.6 How do I find the total results count?
    - [ ] 2.7 Check if there's upper limit on the listing results
      - [ ] 2.7.1 If so, what strategies are available to get over the limit?
    - [ ] 2.8 What filters are available?
      - [ ] 2.8.1 Are the filters set via query params, post body, interaction with server, or other?
      - [ ] 2.8.2 Identify the available / permitted values for each of filters?
    - [ ] 2.9 Is there option to set items per page and / or current page?
      - [ ] 2.9.1 If available, to how high value can I set items per page? Does it impact load time?
    - [ ] 2.10 How do I reset the filter? Do I need to interact with the server (like in SKSCRIS?)
    - [ ] 2.11 Is there other data on the entries that's on the listing page, but not on entry page?
    - [ ] 2.12 Is the data on listing page sufficient for a "simple" version of the dataset?
    - [ ] 2.13 Are there non-entry elements in the list? (E.g. inline ads) How do I exclude them?
    - [ ] 2.14 How do I know if there are no results on the page?
      - [ ] 2.14.1 In such case, how do I know whether it's the end of the pagination?
    - [ ] 2.15 How do I identify the next page URL or action to load next page?
    - [ ] 2.16 How do if I'm on last page of pagination?

4. Actor input options
    - [ ] 8.1 Add input options to interface
    - [ ] 8.2 Implement new actor inputs
    - [ ] 8.3 Add the input options to actor config (`config.ts` or `actor.json`)
    - [ ] 8.4 Update actor input validation in `validation.ts`

5. Types & tests
    - [ ] 9.1 Write basic tests (e.g. the ones using `dataset` input) and make them pass without validation
    - [ ] 9.2 Print the results and define types for the entries
      - [ ] 9.2.1 Don't forget to update the entry types in rest of the code too
    - [ ] 9.3 Write entry validation for tests and update the tests to use it
    - [ ] 9.4 Write tests for each of the dataset types
