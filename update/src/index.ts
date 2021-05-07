import * as crypto from 'crypto'
import { sequenceT } from 'fp-ts/Apply'
import { flow, pipe, tupled } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import { concatAll } from 'fp-ts/Semigroup'
import * as TE from 'fp-ts/TaskEither'
import { taskify } from 'fp-ts/TaskEither'
import * as fs from 'fs'
import * as d from 'io-ts/Decoder'
import * as N3 from 'n3'
import { NamedNode, Quad } from 'rdf-js'
import { csv } from './csv'
import { getUrl } from './http'
import * as namespaces from './namespace'
import { dcterms, fabio, frbr, rdf, rdfs, sciety } from './namespace'
import { exit } from './process'
import * as S from './string'

const { literal, triple } = N3.DataFactory

const review = d.tuple(
  d.string,
  d.string,
  d.string,
)

type Review = d.TypeOf<typeof review>

const reviews = csv(d.array(review))

const concatQuads = concatAll<ReadonlyArray<Quad>>(RA.getSemigroup())(RA.empty)

const md5 = (string: string) => () => crypto.createHash('md5').update(string).digest('hex')

const partToHashedIri = flow(md5, IO.map(sciety))

const partsToIri = flow(S.join(S.empty), sciety)

const biorxivWork = (work: NamedNode) => [
  triple(
    work,
    rdf.type,
    fabio.ResearchPaper,
  ),
  triple(
    work,
    rdfs.label,
    literal('A paper'),
  )
]

const biorxivExpression = (work: NamedNode, expression: NamedNode) => [
  triple(
    expression,
    rdf.type,
    fabio.Article,
  ),
  triple(
    expression,
    rdfs.label,
    literal('bioRxiv version 1'),
  ),
  triple(
    expression,
    frbr.realizationOf,
    work,
  ),
  triple(
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
  IO.map(concatQuads),
  TE.fromIO,
)

const prefixes = pipe(
  namespaces,
  RR.map(namespace => namespace()),
)

const writeTo = (path: fs.PathLike) => (quads: ReadonlyArray<Quad>) => {
  const writer = new N3.Writer(fs.createWriteStream(path), {
    format: 'Turtle', prefixes
  })
  writer.addQuads(RA.toArray(quads))

  return taskify((...args) => writer.end(...args))()
}

pipe(
  'https://github.com/sciety/sciety/raw/main/data/reviews/4eebcec9-a4bb-44e1-bde3-2ae11e65daaa.csv',
  getUrl(reviews),
  TE.chainW(TE.traverseArray(toRdf)),
  TE.map(RA.flatten),
  TE.chainFirstIOK(writeTo('output.ttl')),
  exit,
)()
