import { serializers } from '@rdfjs-elements/formats-pretty'
import { flow, pipe } from 'fp-ts/function'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as T from 'fp-ts/Task'
import pEvent from 'p-event'
import { Writable } from 'stream'
import * as D from './dataset'
import * as fs from './fs'
import * as RDF from './rdf'
import * as S from './string'
import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'

const writeTo = (stream: Writable) => (prefixes: {
  [key: string]: RDF.NamedNode
}) => <A extends RDF.Quad>(dataset: D.DatasetCore<A, RDF.BaseQuad>): TE.TaskEither<Error, void> => {
  const graphPrefixes = pipe(
    prefixes,
    RR.map(namespace => namespace.value),
  )

  const quadStream = pipe(
    dataset,
    D.toStreamMap<A>(RDF.ord, RDF.toTriple),
  )

  const serialized = serializers.import('text/turtle', quadStream, { prefixes: graphPrefixes })

  if (!serialized) {
    return TE.left(new Error('Serializer not initialised'))
  }

  serialized.on('data', flow(
    String,
    S.replaceAll('\t', '  '),
    data => stream.write(data),
  ))

  serialized.on('end', () => stream.end())

  return TE.tryCatch(() => pEvent(stream, 'finish'), E.toError)
}

export const writeToFile = flow(
  fs.createWriteStream,
  writeTo,
)
