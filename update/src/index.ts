import { date, publisher, title, toRule, url } from '@metascraper/helpers'
import { sequenceT } from 'fp-ts/Apply'
import * as E from 'fp-ts/Either'
import { constVoid, flow, identity, pipe } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as O from 'fp-ts/Option'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import metascraper from 'metascraper'
import path from 'path'
import puppeteer, { Browser } from 'puppeteer'
import { URL } from 'url'
import { biorxivArticleDetails } from './biorxiv'
import { csv } from './csv'
import * as D from './dataset'
import { getFromUrl, getUrl } from './http'
import * as namespaces from './namespace'
import { cito, dcterms, fabio, frbr, org, rdf, rdfs, sciety } from './namespace'
import { exit } from './process'
import * as RDF from './rdf'
import * as S from './string'

const doiRegex = /^10\.[0-9]{4,}(?:\.[1-9][0-9]*)*\/[^%"#?\s]+$/

const doi = (value: unknown) => typeof value === 'string' && doiRegex.test(value) ? value : undefined

const scraper = TE.tryCatchK(metascraper([
  {
    author: [
      toRule(title)($ => $('meta[name="citation_author"]').attr('content')),
      ...require('metascraper-author')().author,
    ],
    date: [
      toRule(date)($ => $('meta[name="citation_publication_date"]').attr('content')),
      ...require('metascraper-date')().date,
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
    decoder.decode,
    E.mapLeft(flow(
      d.draw,
      S.prependWith(`Failed to decode ${args.url}:\n`),
    )),
  )),
)

const dateFromIsoString: d.Decoder<unknown, Date> = pipe(
  d.string,
  d.parse(value => {
    const date = new Date(value)
    return isNaN(date.getTime()) ? d.failure(value, 'dateFromIsoString') : d.success(date)
  })
)

const urlFromString: d.Decoder<unknown, URL> = pipe(
  d.string,
  d.parse(value => {
    try {
      return d.success(new URL(value))
    } catch (err) {
      return d.failure(value, 'urlFromString')
    }
  })
)

const scraped = d.struct({
  author: d.string,
  date: dateFromIsoString,
  doi: d.nullable(d.string),
  lang: d.string,
  journal: d.nullable(d.string),
  pdf: d.nullable(urlFromString),
  publisher: d.string,
  title: d.string,
  url: urlFromString,
})

type Scraped = d.TypeOf<typeof scraped>

const review = d.tuple(
  d.string,
  d.string,
  d.string,
)

type Review = d.TypeOf<typeof review>

const reviews = csv(d.array(review))

const partToHashedIri = flow(S.md5, IO.map(sciety))

const biorxivWork = (work: RDF.NamedNode) => D.fromArray([
  RDF.triple(work, rdf.type, fabio.ResearchPaper),
  RDF.triple(work, rdfs.label, RDF.literal('A paper'))
])

const doiToArticleWork = flow(
  partToHashedIri,
  IO.map(biorxivWork)
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

const doiToExpression = (browser: Browser) => ({
  url,
  expression,
  work
}: { url: string, expression: RDF.NamedNode, work: RDF.NamedNode }) => pipe(
  pipe(
    url,
    getFromUrl(browser),
    TE.chain(scrape(scraped)),
  ),
  TE.chainIOK(data => doiExpression({ data, expression, work })),
)

const doiToArticleExpressions = (browser: Browser) => (doi: string) => pipe(
  `https://api.biorxiv.org/details/biorxiv/${doi}`,
  getUrl(browser)(biorxivArticleDetails),
  TE.alt(() => pipe(
    `https://api.biorxiv.org/details/medrxiv/${doi}`,
    getUrl(browser)(biorxivArticleDetails),
  )),
  TE.apSW('work', pipe(doi, partToHashedIri, TE.rightIO)),
  TE.map(details => pipe(
    details.collection,
    RA.map(articleVersion => O.some({
      url: `https://www.${articleVersion.server}.org/content/${articleVersion.doi}v${articleVersion.version}`,
      expression: sciety(`${articleVersion.doi}v${articleVersion.version}`),
      work: details.work,
    })),
    RA.append(pipe(
      details.collection[0].published,
      O.map(doi => ({
        url: `https://doi.org/${doi}`,
        expression: sciety(doi),
        work: details.work,
      })),
    )),
    RA.compact,
  )),
  TE.chain(TE.traverseArray(doiToExpression(browser))),
  TE.map(D.concatAll),
)

const reviewExpression = ({
  articleWork,
  expression,
  data
}: { articleWork: RDF.NamedNode, expression: RDF.NamedNode, data: Scraped }) => pipe(
  IO.Do,
  IO.apS('work', pipe(expression.value, S.appendWith('#work'), partToHashedIri)),
  IO.apS('webPage', pipe(expression.value, S.appendWith('#web'), partToHashedIri)),
  IO.apS('pdf', pipe(expression.value, S.appendWith('#pdf'), partToHashedIri)),
  IO.map(({ work, webPage, pdf }) => pipe(
    [
      RDF.triple(expression, rdf.type, fabio.ReviewArticle),
      RDF.triple(expression, dcterms.title, RDF.languageTaggedString(data.title, data.lang)),
      RDF.triple(expression, frbr.realizationOf, work),
      RDF.triple(expression, fabio.hasManifestation, webPage),
      RDF.triple(expression, dcterms.publisher, sciety('pci-animal-science')),
      RDF.triple(work, rdf.type, fabio.Review),
      RDF.triple(work, dcterms.creator, RDF.list([RDF.literal(data.author)])),
      RDF.triple(work, dcterms.date, RDF.date(data.date)),
      RDF.triple(work, cito.citesAsRecommendedReading, articleWork),
      RDF.triple(webPage, rdf.type, fabio.WebPage),
      RDF.triple(webPage, fabio.hasURL, RDF.url(data.url)),
    ],
    D.fromArray,
    data.doi ? D.insert(RDF.triple(expression, dcterms.identifier, RDF.literal(`doi:${data.doi}`))) : identity,
    data.pdf ? D.union(D.fromArray([
      RDF.triple(expression, fabio.hasManifestation, pdf),
      RDF.triple(pdf, rdf.type, fabio.DigitalManifestation),
      RDF.triple(pdf, dcterms.format, RDF.literal('application/pdf')),
      RDF.triple(pdf, fabio.hasURL, RDF.url(data.pdf)),
    ])) : identity,
  ))
)

const reviewIdToUrl = (reviewId: string) => reviewId.replace('doi:', 'https://doi.org/')

const reviewIdToReview = (browser: Browser) => flow(
  ([articleDoi, reviewId]: [string, string]) => ({ articleDoi, reviewId }),
  TE.right,
  TE.bind('url', ({ reviewId }) => pipe(reviewId, reviewIdToUrl, TE.right)),
  TE.bind('articleWork', ({ articleDoi }) => pipe(articleDoi, partToHashedIri, TE.rightIO)),
  TE.bindW('expression', ({ url }) => pipe(url.replace('https://doi.org/', ''), sciety, TE.right)),
  TE.bind('data', ({ url }) => pipe(url, getFromUrl(browser), TE.chain(scrape(scraped)))),
  TE.chainIOK(reviewExpression),
)

const toRdf = (browser: Browser) => ([, articleDoi, reviewId]: Review) => pipe(
  sequenceT(TE.ApplyPar)(
    pipe(articleDoi, doiToArticleWork, TE.fromIO),
    pipe(articleDoi, doiToArticleExpressions(browser)),
    pipe([articleDoi, reviewId], reviewIdToReview(browser))
  ),
  TE.map(D.concatAll),
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
