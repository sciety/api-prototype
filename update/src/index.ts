import * as crypto from 'crypto'
import { sequenceT } from 'fp-ts/Apply'
import { flow, pipe } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import { concatAll } from 'fp-ts/Semigroup'
import * as TE from 'fp-ts/TaskEither'
import { taskify } from 'fp-ts/TaskEither'
import * as fs from 'fs'
import * as d from 'io-ts/Decoder'
import * as N3 from 'n3'
import { DataFactory, Quad } from 'n3'
import { csv } from './csv'
import { getUrl } from './http'
import * as namespaces from './namespace'
import { dcterms, fabio, frbr, rdf, rdfs, sciety, xsd } from './namespace'
import { exit } from './process'

const { blankNode, literal, triple } = DataFactory

const review = d.tuple(
  d.string,
  d.string,
  d.string,
)

type Review = d.TypeOf<typeof review>

const reviews = csv(d.array(review))

const md5 = (string: string) => () => crypto.createHash('md5').update(string).digest('hex')

const createIri = flow(md5, IO.map(sciety))

const reviewToWork = ([, article]: Review) => pipe(
  article,
  createIri,
  IO.map((work) => [
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
  ])
)

const reviewToExpression = ([, article]: Review) => pipe(
  IO.Do,
  IO.apS('work', pipe(article, createIri)),
  IO.apS('expression', pipe(`${article}v1`, sciety, IO.of)),
  IO.apS('webPage', blankNode),
  IO.apS('pdf', blankNode),
  IO.map(({ work, expression, webPage, pdf }) => [
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
    triple(
      expression,
      fabio.hasManifestation,
      webPage,
    ),
    triple(
      expression,
      fabio.hasManifestation,
      pdf,
    ),
    triple(
      webPage,
      rdf.type,
      fabio.WebPage,
    ),
    triple(
      webPage,
      fabio.hasURL,
      literal(`https://www.biorxiv.org/content/${article}v1`, xsd.anyURI),
    ),
    triple(
      pdf,
      rdf.type,
      fabio.DigitalManifestation,
    ),
    triple(
      pdf,
      dcterms.format,
      literal('application/pdf'),
    ),
    triple(
      webPage,
      fabio.hasURL,
      literal(`https://www.biorxiv.org/content/${article}v1.pdf`, xsd.anyURI),
    ),
  ])
)

const toRdf = (review: Review) => pipe(
  sequenceT(IO.Apply)(reviewToWork(review), reviewToExpression(review)),
  IO.map(concatAll<ReadonlyArray<Quad>>(RA.getSemigroup())(RA.empty)),
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
