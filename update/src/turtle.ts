import { serializers } from '@rdfjs-elements/formats-pretty'
import * as E from 'fp-ts/Either'
import { flow, pipe } from 'fp-ts/function'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as TE from 'fp-ts/TaskEither'
import pEvent from 'p-event'
import { Writable } from 'stream'
import * as D from './dataset'
import * as fs from './fs'
import * as RDF from './rdf'
import * as S from './string'

const graphPrefixes = RR.map((namespace: RDF.NamedNode) => namespace.value)

const writeTo = (stream: Writable) => <A extends RDF.Quad>(prefixes: {
  [key: string]: RDF.NamedNode
}): (dataset: D.DatasetCore<A, RDF.BaseQuad>) => TE.TaskEither<Error, void> => flow(
  D.toStreamMap<A>(RDF.ord, RDF.toTriple),
  quadStream => serializers.import('text/turtle', quadStream, { prefixes: pipe(prefixes, graphPrefixes) }),
  E.fromNullable(new Error('Serializer not initialised')),
  TE.fromEither,
  TE.chainFirstIOK(serialized => () => serialized
    .on('data', flow(
      String,
      S.replaceAll('\t', '  '),
      data => stream.write(data),
    ))
    .on('end', () => stream.end())
  ),
  TE.chain(() => TE.tryCatch(() => pEvent(stream, 'finish'), E.toError)),
)

export const writeToFile = flow(
  fs.createWriteStream,
  writeTo,
)
