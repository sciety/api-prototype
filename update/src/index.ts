import * as crypto from 'crypto'
import { sequenceT } from 'fp-ts/Apply'
import { flow, pipe, tupled } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import { biorxivArticleDetails, BiorxivArticleVersion } from './biorxiv'
import { csv } from './csv'
import * as D from './dataset'
import { getUrl } from './http'
import * as namespaces from './namespace'
import { dcterms, fabio, frbr, rdf, rdfs, sciety, xsd } from './namespace'
import { exit } from './process'
import * as RDF from './rdf'
import * as S from './string'

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

const toRdf = ([, articleDoi]: Review) => pipe(
  sequenceT(TE.ApplyPar)(
    pipe(articleDoi, doiToArticleWork, TE.fromIO),
    pipe(articleDoi, doiToArticleExpressions),
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
