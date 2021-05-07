import * as crypto from 'crypto'
import { sequenceT } from 'fp-ts/Apply'
import { flow, pipe, tupled } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import { csv } from './csv'
import { getUrl } from './http'
import * as namespaces from './namespace'
import { dcterms, fabio, frbr, rdf, rdfs, sciety } from './namespace'
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

const biorxivWork = (work: RDF.NamedNode) => [
  RDF.triple(
    work,
    rdf.type,
    fabio.ResearchPaper,
  ),
  RDF.triple(
    work,
    rdfs.label,
    RDF.literal('A paper'),
  )
]

const biorxivExpression = (work: RDF.NamedNode, expression: RDF.NamedNode) => [
  RDF.triple(
    expression,
    rdf.type,
    fabio.Article,
  ),
  RDF.triple(
    expression,
    rdfs.label,
    RDF.literal('bioRxiv version 1'),
  ),
  RDF.triple(
    expression,
    frbr.realizationOf,
    work,
  ),
  RDF.triple(
    expression,
    dcterms.publisher,
    sciety.biorxiv,
  ),
]

const doiToArticleWork = flow(
  partToHashedIri,
  IO.map(biorxivWork)
)

const doiToArticleExpression = flow(
  (doi: string) => sequenceT(IO.Apply)(
    pipe(doi, partToHashedIri),
    pipe([doi, 'v1'], partsToIri, IO.of),
  ),
  IO.map(tupled(biorxivExpression))
)

const toRdf = ([, articleDoi]: Review) => pipe(
  sequenceT(IO.Apply)(
    pipe(articleDoi, doiToArticleWork),
    pipe(articleDoi, doiToArticleExpression),
  ),
  IO.map(RDF.concatQuads),
  TE.fromIO,
)

const prefixes = pipe(
  namespaces,
  RR.map(namespace => namespace()),
)

pipe(
  'https://github.com/sciety/sciety/raw/main/data/reviews/4eebcec9-a4bb-44e1-bde3-2ae11e65daaa.csv',
  getUrl(reviews),
  TE.chainW(TE.traverseArray(toRdf)),
  TE.map(RA.flatten),
  TE.chainFirstIOK(RDF.writeTo('output.ttl', { format: 'turtle', prefixes })),
  exit,
)()
