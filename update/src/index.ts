import { title, toRule } from '@metascraper/helpers'
import * as crypto from 'crypto'
import { sequenceT } from 'fp-ts/Apply'
import * as E from 'fp-ts/Either'
import { flow, identity, pipe, tupled } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import metascraper from 'metascraper'
import { biorxivArticleDetails, BiorxivArticleVersion } from './biorxiv'
import { csv } from './csv'
import * as D from './dataset'
import { getFromUrl, getUrl } from './http'
import * as namespaces from './namespace'
import { dcterms, fabio, frbr, rdf, rdfs, sciety, xsd } from './namespace'
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
    doi: [
      toRule(doi)($ => $('meta[name="citation_doi"]').attr('content')),
    ],
    title: [
      toRule(title)($ => $('meta[name="citation_title"]').attr('content')),
      ...require('metascraper-title')().title,
    ],
  },
  require('metascraper-lang')(),
]), E.toError)

const scrape = <V extends RR.ReadonlyRecord<string, unknown>>(decoder: d.Decoder<unknown, V>) => <T extends { url: string, html: string }>(args: T) => pipe(
  args,
  scraper,
  TE.chainEitherKW(flow(
    decoder.decode,
    E.mapLeft(d.draw),
  )),
)

const scraped = d.struct({
  author: d.string,
  doi: d.nullable(d.string),
  lang: d.string,
  title: d.string,
})

type Scraped = d.TypeOf<typeof scraped>

const review = d.tuple(
  d.string,
  d.string,
  d.string,
)

type Review = d.TypeOf<typeof review>

const reviews = csv(d.array(review))

const md5 = (string: string) => () => crypto.createHash('md5').update(string).digest('hex')

const partToHashedIri = flow(md5, IO.map(sciety))

const partsToIri = flow(S.join(S.empty), sciety)

const biorxivWork = (work: RDF.NamedNode) => D.fromArray([
  RDF.triple(work, rdf.type, fabio.ResearchPaper),
  RDF.triple(work, rdfs.label, RDF.literal('A paper'))
])

const biorxivExpression = (articleVersion: BiorxivArticleVersion, work: RDF.NamedNode, expression: RDF.NamedNode) => {
  const webPage = RDF.blankNode()
  const pdf = RDF.blankNode()

  return D.fromArray([
    RDF.triple(expression, rdf.type, fabio.Article),
    RDF.triple(expression, rdfs.label, RDF.literal(`bioRxiv version ${articleVersion.version}`)),
    RDF.triple(expression, dcterms.title, RDF.literal(articleVersion.title)),
    RDF.triple(expression, dcterms.date, RDF.typedLiteral(articleVersion.date, xsd.date)),
    RDF.triple(expression, frbr.realizationOf, work,),
    RDF.triple(expression, dcterms.publisher, sciety.biorxiv),
    RDF.triple(expression, fabio.hasManifestation, webPage),
    RDF.triple(expression, fabio.hasManifestation, pdf),
    RDF.triple(webPage, rdf.type, fabio.WebPage),
    RDF.triple(webPage, fabio.hasURL, RDF.typedLiteral(`https://www.biorxiv.org/content/${articleVersion.doi}v${articleVersion.version}`, xsd.anyURI)),
    RDF.triple(pdf, rdf.type, fabio.DigitalManifestation),
    RDF.triple(pdf, dcterms.format, RDF.literal('application/pdf')),
    RDF.triple(pdf, fabio.hasURL, RDF.typedLiteral(`https://www.biorxiv.org/content/${articleVersion.doi}v${articleVersion.version}.pdf`, xsd.anyURI)),
  ])
}

const doiToArticleWork = flow(
  partToHashedIri,
  IO.map(biorxivWork)
)

const detailsToArticleExpression = (articleVersion: BiorxivArticleVersion) => pipe(
  sequenceT(IO.Apply)(
    pipe(articleVersion, IO.of),
    pipe(articleVersion.doi, partToHashedIri),
    pipe([articleVersion.doi, `v${articleVersion.version}`], partsToIri, IO.of),
  ),
  IO.map(tupled(biorxivExpression))
)

const doiToArticleExpressions = (doi: string) => pipe(
  `https://api.biorxiv.org/details/biorxiv/${doi}`,
  getUrl(biorxivArticleDetails),
  TE.chainIOK(flow(
    details => details.collection,
    RA.map(detailsToArticleExpression),
    IO.sequenceArray,
    IO.map(D.concatAll)
  ))
)

const reviewExpression = ({ expression, data }: { expression: RDF.NamedNode, data: Scraped }) => {
  const work = RDF.blankNode()

  return pipe(
    [
      RDF.triple(expression, rdf.type, fabio.ReviewArticle),
      RDF.triple(expression, dcterms.title, RDF.languageTaggedString(data.title, data.lang)),
      RDF.triple(expression, frbr.realizationOf, work),
      RDF.triple(work, rdf.type, fabio.Review),
      RDF.triple(work, dcterms.creator, RDF.list([RDF.literal(data.author)])),
    ],
    D.fromArray,
    data.doi ? D.insert(RDF.triple(expression, dcterms.identifier, RDF.literal(`doi:${data.doi}`))) : identity,
  )
}

const reviewIdToUrl = (reviewId: string) => reviewId.replace('doi:', 'https://doi.org/')

const reviewIdToReview = flow(
  reviewIdToUrl,
  TE.right,
  TE.bindTo('url'),
  TE.bind('expression', ({ url }) => pipe(url, RDF.namedNode, TE.right)),
  TE.bind('html', ({ url }) => pipe(url, getFromUrl)),
  TE.bindW('data', scrape(scraped)),
  TE.map(reviewExpression),
)

const toRdf = ([, articleDoi, reviewId]: Review) => pipe(
  sequenceT(TE.ApplyPar)(
    pipe(articleDoi, doiToArticleWork, TE.fromIO),
    pipe(articleDoi, doiToArticleExpressions),
    pipe(reviewId, reviewIdToReview)
  ),
  TE.map(D.concatAll),
)

const prefixes = pipe(
  namespaces,
  RR.map(namespace => namespace()),
)

pipe(
  'https://github.com/sciety/sciety/raw/main/data/reviews/4eebcec9-a4bb-44e1-bde3-2ae11e65daaa.csv',
  getUrl(reviews),
  TE.chainW(TE.traverseArray(toRdf)),
  TE.map(D.concatAll),
  TE.chainFirstIOK(RDF.writeTo('output.ttl', { format: 'turtle', prefixes })),
  exit,
)()
