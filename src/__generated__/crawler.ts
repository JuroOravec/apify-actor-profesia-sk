import { AllActorInputs, CrawleeOneActorRouterCtx, CrawleeOneActorInst, CrawleeOneRoute, CrawleeOneRouteHandler, CrawleeOneRouteWrapper, CrawleeOneRouteMatcher, CrawleeOneRouteMatcherFn, CrawleeOneIO, CrawleeOneTelemetry, CrawleeOneCtx, CrawleeOneArgs, crawleeOne } from "crawlee-one"
import type { BasicCrawlingContext, HttpCrawlingContext, CheerioCrawlingContext, JSDOMCrawlingContext, PlaywrightCrawlingContext, PuppeteerCrawlingContext } from "crawlee"


export type MaybePromise<T> = T | Promise<T>;

export type profesiaLabel = "mainPage" | "jobListing" | "jobDetail" | "jobRelatedList" | "companyDetailCustom" | "partners";

export enum profesiaLabelEnum {
  'mainPage' = 'mainPage',
  'jobListing' = 'jobListing',
  'jobDetail' = 'jobDetail',
  'jobRelatedList' = 'jobRelatedList',
  'companyDetailCustom' = 'companyDetailCustom',
  'partners' = 'partners'
}

export type profesiaCtx<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneCtx<CheerioCrawlingContext, profesiaLabel, TInput, TIO, Telem>;

export const profesiaCrawler = <TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>>(args: Omit<CrawleeOneArgs<"cheerio", profesiaCtx<TInput, TIO, Telem>>, 'type'>) => crawleeOne<"cheerio", profesiaCtx<TInput, TIO, Telem>>({ ...args, type: "cheerio"});;

export type profesiaRouterContext<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneActorRouterCtx<profesiaCtx<TInput, TIO, Telem>>;

export type profesiaActorCtx<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneActorInst<profesiaCtx<TInput, TIO, Telem>>;

export type profesiaRoute<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRoute<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaRouteHandler<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRouteHandler<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaRouteWrapper<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRouteWrapper<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaRouteMatcher<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRouteMatcher<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaRouteMatcherFn<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRouteMatcherFn<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaOnBeforeHandler<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRouteHandler<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaOnAfterHandler<TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>> = CrawleeOneRouteHandler<profesiaCtx<TInput, TIO, Telem>, profesiaRouterContext<TInput, TIO, Telem>>;

export type profesiaOnReady = <TInput extends Record<string, any> = AllActorInputs, TIO extends CrawleeOneIO = CrawleeOneIO, Telem extends CrawleeOneTelemetry<any, any> = CrawleeOneTelemetry<any, any>>(actor: profesiaActorCtx<TInput, TIO, Telem>) => MaybePromise<void>;;