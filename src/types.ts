export type MaybePromise<T> = T | Promise<T>;

/** Shape of the data passed to the actor from Apify */
export interface ApifyStoreActorInput {
  startUrls: string[];
  query?: string;
  category?: string;
}

export interface CategoriesQueryRequestPayload {
  query: string;
  /** Eg `0` */
  page: number;
  /** Default `24` */
  hitsPerPage: number;
  restrictSearchableAttributes: unknown[];
  attributesToHighlight: unknown[];
  /** Default `["title","name","username","userFullName","stats","description","pictureUrl","userPictureUrl","notice","currentPricingInfo"]` */
  attributesToRetrieve: string[];
  /** Eg `"categories:AI"` */
  filters?: string;
}

export interface CategoriesQueryResponsePayload {
  hits?: ApifyActorStoreItem[];
  nbHits?: number;
}

export interface ApifyActorStoreItem {
  /** Eg `"moJRLRc85AitArpNN"` */
  objectID: string;
  /** Eg `"Web Scraper"` */
  title: string;
  /** Eg `"web-scraper"` */
  name: string;
  /** Eg `"apify"` */
  username: string;
  stats: {
    /** Eg `119` */
    totalBuilds: number;
    /** Eg `134565415` */
    totalRuns: number;
    /** Eg `39176` */
    totalUsers: number;
    /** Eg `"2023-04-12T14:05:43.881Z"` */
    lastRunStartedAt: string;
    /** Eg `109822` */
    totalMetamorphs: number;
    /** Eg `2495` */
    totalUsers30Days: number;
    /** Eg `1176` */
    totalUsers7Days: number;
    /** Eg `5736` */
    totalUsers90Days: number;
  };
  /** Eg `"Crawls arbitrary websites using the Chrome browser and extracts data from pages using a provided JavaScript code. The actor supports both recursive crawling and lists of URLs and automatically manages concurrency for maximum performance. This is Apify's basic tool for web crawling and scraping."` */
  description: string;
  /** Eg `"https://apify-image-uploads-prod.s3.amazonaws.com/moJRLRc85AitArpNN/Zn8vbWTika7anCQMn-SD-02-02.png"` */
  pictureUrl: string;
  /** Eg `"NONE"` */
  notice: string;
  /** Eg `"https://images.apifyusercontent.com/RfzgvWemVJ37Tu7JrgB8AF8fvOOQVMY201Ww6shxg1E/rs:fill:32:32/aHR0cHM6Ly9hcGlmeS1pbWFnZS11cGxvYWRzLXByb2QuczMuYW1hem9uYXdzLmNvbS9ac2NNd0ZSNUg3ZUN0V3R5aC9ZcXRrUW1FeFpwbU1kNmRKUS1hcGlmeV9zeW1ib2xfd2hpdGVfYmcucG5n.png"` */
  userPictureUrl: string;
  /** Eg `"Apify"` */
  userFullName: string;
  currentPricingInfo: {
    /** Eg `"PRICE_PER_DATASET_ITEM"` */
    pricingModel: 'PRICE_PER_DATASET_ITEM' | 'FLAT_PRICE_PER_MONTH' | 'FREE';
    /** Eg `0.009` */
    pricePerUnitUsd: number;
    /** Eg `0` */
    apifyMarginPercentage: number;
    /** Eg `"2023-04-04T12:26:19.892Z"` */
    createdAt: string;
    /** Eg `"2023-04-04T12:26:19.892Z"` */
    startedAt: string;
    /** Eg `"page"` */
    unitName?: string;
  } | null;
  /** CUSTOM FIELD to collect categories */
  categories?: string[];
}
