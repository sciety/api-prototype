import { date, publisher, title, toRule, url } from '@metascraper/helpers'
import { sequenceT } from 'fp-ts/Apply'
import * as E from 'fp-ts/Either'
import { constVoid, flow, identity, pipe } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as O from 'fp-ts/Option'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import metascraper from 'metascraper'
import path from 'path'
import puppeteer, { Browser } from 'puppeteer'
import { BiorxivArticleDetails, biorxivArticleDetails } from './biorxiv'
import { CrossrefWork, crossrefWork } from './crossref'
import * as D from './dataset'
import * as d from './decoder'
import { getFromUrl, getUrl } from './http'
import * as namespaces from './namespace'
import { cito, dcterms, fabio, frbr, org, rdf, rdfs, sciety } from './namespace'
import { exit } from './process'
import * as RDF from './rdf'
import * as S from './string'

const doiRegex = /^10\.[0-9]{4,}(?:\.[1-9][0-9]*)*\/[^%"#?\s]+$/

const doi = (value: unknown) => typeof value === 'string' && doiRegex.test(value) ? value : undefined

const doiToUrl = S.prependWith('https://doi.org/')

const scraper = TE.tryCatchK(metascraper([
  {
    author: [
      toRule(title)($ => $('meta[name="citation_author"]').attr('content')),
      ...require('metascraper-author')().author,
    ],
    date: [
      toRule(date)($ => $('meta[name="citation_date"]').attr('content')),
      ...require('metascraper-date')().date,
      toRule(date)($ => $('meta[name="citation_publication_date"]').attr('content')),
    ],
    doi: [
      toRule(doi)($ => $('meta[name="citation_doi"]').attr('content')),
    ],
    journal: [
      toRule(publisher)($ => $('meta[name="citation_journal_title"]').attr('content')),
    ],
    publisher: [
      toRule(publisher)($ => $('meta[name="citation_publisher"]').attr('content')),
      ...require('metascraper-publisher')().publisher,
    ],
    title: [
      toRule(title)($ => $('meta[name="citation_title"]').attr('content')),
      ...require('metascraper-title')().title,
    ],
    pdf: [
      toRule(url)($ => $('meta[name="citation_pdf_url"]').attr('content')),
    ]
  },
  require('metascraper-lang')(),
  require('metascraper-url')(),
]), E.toError)

const scrape = <V extends RR.ReadonlyRecord<string, unknown>>(decoder: d.Decoder<unknown, V>) => <T extends { url: string, text: string }>(args: T) => pipe(
  {
    ...args,
    html: args.text,
  },
  scraper,
  TE.chainEitherKW(flow(
    d.decodeWith(decoder),
    E.mapLeft(S.prependWith(`Failed to decode ${args.url}:\n`))
  )),
)

const scraped = d.struct({
  author: d.arrayFromString(', '),
  date: d.dateFromIsoString,
  doi: d.nullable(d.string),
  lang: d.nullable(d.string),
  journal: d.nullable(d.string),
  pdf: d.nullable(d.urlFromString),
  publisher: d.string,
  title: d.string,
  url: d.urlFromString,
})

type Scraped = d.TypeOf<typeof scraped>

const crossrefToScraped = ({ message }: CrossrefWork): Scraped => ({
  author: [],
  date: message.indexed['date-time'],
  doi: message.DOI,
  lang: pipe(message.language, O.toNullable),
  journal: pipe(message['container-title'], RA.head, O.toNullable),
  pdf: null,
  publisher: message.publisher,
  title: message.title[0],
  url: message.URL,
})

const review = d.tuple(
  d.string,
  d.string,
  d.string,
)

type Review = d.TypeOf<typeof review>

const reviews = d.csv(d.array(review))

const partToHashedIri = flow(S.md5, IO.map(sciety))

const doiVersionIri = <T extends { doi: string, version: string }>({
  doi,
  version
}: T) => pipe([doi, version], S.join('v'), sciety)

const biorxivWork = (details: BiorxivArticleDetails) => (work: RDF.NamedNode) => D.fromArray([
  RDF.triple(work, rdf.type, fabio.ResearchPaper),
  RDF.triple(work, rdfs.label, pipe(details.collection, RNEA.last, version => version.title, RDF.literal)),
])

const doiToArticleWork = (details: BiorxivArticleDetails) => flow(
  partToHashedIri,
  IO.map(biorxivWork(details))
)

const doiExpression = ({
  work,
  expression,
  data
}: { work: RDF.NamedNode, expression: RDF.NamedNode, data: Scraped }) => pipe(
  IO.Do,
  IO.apS('webPage', pipe(expression.value, S.appendWith('#web'), partToHashedIri)),
  IO.apS('pdf', pipe(expression.value, S.appendWith('#pdf'), partToHashedIri)),
  IO.apS('publisher', pipe(data.publisher, partToHashedIri)),
  IO.apS('journal', pipe(data.journal ?? '', partToHashedIri)),
  IO.map(({ webPage, pdf, publisher, journal }) => pipe(
    [
      RDF.triple(expression, rdf.type, fabio.Article),
      RDF.triple(expression, dcterms.title, RDF.literal(data.title)),
      RDF.triple(expression, dcterms.date, RDF.date(data.date)),
      RDF.triple(expression, frbr.realizationOf, work),
      RDF.triple(expression, dcterms.publisher, publisher),
      RDF.triple(expression, fabio.hasManifestation, webPage),
      RDF.triple(expression, fabio.hasManifestation, pdf),
      RDF.triple(webPage, rdf.type, fabio.WebPage),
      RDF.triple(webPage, fabio.hasURL, RDF.url(data.url)),
      RDF.triple(publisher, rdf.type, org.Organization),
      RDF.triple(publisher, rdfs.label, RDF.literal(data.publisher)),
    ],
    D.fromArray,
    data.doi ? D.insert(RDF.triple(expression, dcterms.identifier, RDF.literal(`doi:${data.doi}`))) : identity,
    data.journal ? D.union(D.fromArray([
      RDF.triple(expression, frbr.partOf, journal),
      RDF.triple(journal, rdf.type, fabio.Journal),
      RDF.triple(journal, dcterms.title, RDF.literal(data.journal)),
    ])) : identity,
    data.pdf ? D.union(D.fromArray([
      RDF.triple(expression, fabio.hasManifestation, pdf),
      RDF.triple(pdf, rdf.type, fabio.DigitalManifestation),
      RDF.triple(pdf, dcterms.format, RDF.literal('application/pdf')),
      RDF.triple(pdf, fabio.hasURL, RDF.url(data.pdf)),
    ])) : identity,
  )),
)

const fromCrossrefApi = (browser: Browser) => (doi: string) => pipe(
  doi,
  S.prependWith('https://api.crossref.org/v1/works/'),
  getUrl(browser)(crossrefWork),
  TE.map(crossrefToScraped),
)

const doiToExpression = (browser: Browser) => ({
  url,
  doi,
  expression,
  work
}: { url: string, doi: string, expression: RDF.NamedNode, work: RDF.NamedNode }) => pipe(
  url,
  getFromUrl(browser),
  TE.chain(scrape(scraped)),
  TE.orElse(() => pipe(doi, fromCrossrefApi(browser))),
  TE.chainIOK(data => doiExpression({ data, expression, work })),
)

const doiToReviewExpression = ({ articleWork, data }: { articleWork: RDF.NamedNode, data: Scraped }) => pipe(
  IO.Do,
  IO.apS('work', pipe(data.url, String, S.appendWith('#review-work'), partToHashedIri)),
  IO.apS('expression', pipe(data.url, String, S.appendWith('#review-expression'), partToHashedIri)),
  IO.apS('publisher', pipe(data.publisher, partToHashedIri)),
  IO.apS('journal', pipe(data.journal ?? '', partToHashedIri)),
  IO.map(({ work, expression, publisher, journal }) => pipe(
    [
      RDF.triple(expression, rdf.type, fabio.ReviewArticle),
      RDF.triple(expression, frbr.realizationOf, work),
      RDF.triple(expression, dcterms.publisher, publisher),
      RDF.triple(work, rdf.type, fabio.Review),
      RDF.triple(work, cito.citesAsRecommendedReading, articleWork),
      RDF.triple(publisher, rdf.type, org.Organization),
      RDF.triple(publisher, rdfs.label, RDF.literal(data.publisher)),
    ],
    D.fromArray,
    data.journal ? D.union(D.fromArray([
      RDF.triple(expression, frbr.partOf, journal),
      RDF.triple(journal, rdf.type, fabio.Journal),
      RDF.triple(journal, dcterms.title, RDF.literal(data.journal)),
    ])) : identity,
  )),
)

const doiToReview = (browser: Browser) => (articleWork: RDF.NamedNode) => (doi: string) => pipe(
  doi,
  fromCrossrefApi(browser),
  TE.chainIOK(data => doiToReviewExpression({ data, articleWork }))
)

const doiToArticleExpressions = (browser: Browser, details: BiorxivArticleDetails) => (doi: string) => pipe(
  details,
  TE.right,
  TE.apSW('work', pipe(doi, partToHashedIri, TE.rightIO)),
  TE.chain(details => pipe(
    details.collection,
    RA.map(articleVersion => O.some({
      url: `https://www.${articleVersion.server}.org/content/${articleVersion.doi}v${articleVersion.version}`,
      doi: articleVersion.doi,
      expression: pipe(articleVersion, doiVersionIri),
      work: details.work,
    })),
    RA.append(pipe(
      details.collection[0].published,
      O.map(doi => ({
        url: pipe(doi, doiToUrl),
        doi,
        expression: sciety(doi),
        work: details.work,
      })),
    )),
    RA.compact,
    TE.traverseArray(doiToExpression(browser)),
    TE.map(D.concatAll),
    TE.chain(dataset => pipe(
      details.collection[0].published,
      O.fold(
        () => TE.right(D.empty),
        doiToReview(browser)(details.work),
      ),
      TE.map(D.union(dataset)),
    )),
  )),
)

const findFirstVersionAfterDate = (date: Date) => (details: BiorxivArticleDetails) => pipe(
  details.collection,
  RA.findLast(version => version.date <= date),
  O.getOrElse(() => details.collection[0])
)

const reviewExpression = ({
  articleWork,
  expression,
  data,
  details,
}: { articleWork: RDF.NamedNode, expression: RDF.NamedNode, data: Scraped, details: BiorxivArticleDetails }) => pipe(
  IO.Do,
  IO.apS('work', pipe(expression.value, S.appendWith('#work'), partToHashedIri)),
  IO.apS('publisher', pipe(data.publisher, partToHashedIri)),
  IO.apS('webPage', pipe(expression.value, S.appendWith('#web'), partToHashedIri)),
  IO.apS('pdf', pipe(expression.value, S.appendWith('#pdf'), partToHashedIri)),
  IO.apS('journal', pipe(data.journal ?? '', partToHashedIri)),
  IO.apS('articleExpression', pipe(details, findFirstVersionAfterDate(data.date), doiVersionIri, IO.of)),
  IO.map(({ work, publisher, webPage, pdf, journal, articleExpression }) => pipe(
    [
      RDF.triple(expression, rdf.type, fabio.ReviewArticle),
      RDF.triple(expression, dcterms.title, data.lang ? RDF.languageTaggedString(data.title, data.lang) : RDF.literal(data.title)),
      RDF.triple(expression, frbr.realizationOf, work),
      RDF.triple(expression, fabio.hasManifestation, webPage),
      RDF.triple(expression, dcterms.publisher, publisher),
      RDF.triple(expression, dcterms.date, RDF.date(data.date)),
      RDF.triple(work, rdf.type, fabio.Review),
      RDF.triple(work, dcterms.creator, pipe(data.author, RA.map(RDF.literal), RDF.list)),
      RDF.triple(work, cito.citesAsRecommendedReading, articleWork),
      RDF.triple(work, cito.reviews, articleExpression),
      RDF.triple(webPage, rdf.type, fabio.WebPage),
      RDF.triple(webPage, fabio.hasURL, RDF.url(data.url)),
      RDF.triple(publisher, rdf.type, org.Organization),
      RDF.triple(publisher, rdfs.label, RDF.literal(data.publisher)),
    ],
    D.fromArray,
    data.doi ? D.insert(RDF.triple(expression, dcterms.identifier, RDF.literal(`doi:${data.doi}`))) : identity,
    data.pdf ? D.union(D.fromArray([
      RDF.triple(expression, fabio.hasManifestation, pdf),
      RDF.triple(pdf, rdf.type, fabio.DigitalManifestation),
      RDF.triple(pdf, dcterms.format, RDF.literal('application/pdf')),
      RDF.triple(pdf, fabio.hasURL, RDF.url(data.pdf)),
    ])) : identity,
    data.journal ? D.union(D.fromArray([
      RDF.triple(expression, frbr.partOf, journal),
      RDF.triple(journal, rdf.type, fabio.Journal),
      RDF.triple(journal, dcterms.title, RDF.literal(data.journal)),
    ])) : identity,
  ))
)

const reviewIdToDoi = (reviewId: string) => reviewId.replace('doi:', '')

const reviewIdToReview = (browser: Browser, details: BiorxivArticleDetails) => flow(
  ([articleDoi, reviewId]: [string, string]) => ({ articleDoi, reviewId }),
  TE.right,
  TE.apS('details', pipe(details, TE.right)),
  TE.bind('doi', ({ reviewId }) => pipe(reviewId, reviewIdToDoi, TE.right)),
  TE.bind('articleWork', ({ articleDoi }) => pipe(articleDoi, partToHashedIri, TE.rightIO)),
  TE.bindW('expression', ({ doi }) => pipe(doi, sciety, TE.right)),
  TE.bind('data', ({ doi }) => pipe(doi, fromCrossrefApi(browser))),
  TE.chainIOK(reviewExpression),
)

const toRdf = (browser: Browser) => ([, articleDoi, reviewId]: Review) => pipe(
  articleDoi,
  getBiorxivDetails(browser),
  TE.chain(details => sequenceT(TE.ApplyPar)(
    pipe(articleDoi, doiToArticleWork(details), TE.fromIO),
    pipe(articleDoi, doiToArticleExpressions(browser, details)),
    pipe([articleDoi, reviewId], reviewIdToReview(browser, details))
  )),
  TE.map(D.concatAll),
)

const getBiorxivDetails = (browser: Browser) => (doi: string) => pipe(
  doi,
  S.prependWith('https://api.biorxiv.org/details/biorxiv/'),
  getUrl(browser)(biorxivArticleDetails),
  TE.alt(() => pipe(
    doi,
    S.prependWith('https://api.biorxiv.org/details/medrxiv/'),
    getUrl(browser)(biorxivArticleDetails),
  ))
)

const prefixes = pipe(
  namespaces,
  RR.map(namespace => namespace()),
)

pipe(
  TE.tryCatch(() => puppeteer.launch({
    headless: true,
    userDataDir: path.join(__dirname, '../cache/puppeteer'),
  }), E.toError),
  TE.chainFirst(browser => pipe(
    'https://github.com/sciety/sciety/raw/main/data/reviews/4eebcec9-a4bb-44e1-bde3-2ae11e65daaa.csv',
    getUrl(browser)(reviews),
    TE.chainW(TE.traverseArray(toRdf(browser))),
    T.chainFirst(() => TE.tryCatch(() => browser.close(), constVoid)),
    TE.map(D.concatAll),
    TE.chainFirstIOK(RDF.writeTo('output.ttl', { format: 'turtle', prefixes })),
  )),
  exit,
)()
