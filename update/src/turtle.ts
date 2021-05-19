import turtleWriter, { C2, C3 } from '@graphy/content.ttl.write'
import * as graphy from '@graphy/core.data.factory'
import { flow, pipe } from 'fp-ts/function'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as T from 'fp-ts/Task'
import { Writable } from 'stream'
import { promisify } from 'util'
import * as D from './dataset'
import * as fs from './fs'
import * as RDF from './rdf'

const toGraphy = (term: RDF.Term): any => {
  switch (term.type) {
    case 'NamedNode':
      return graphy.namedNode(term.value)
    case 'BlankNode':
      return graphy.blankNode(term.name)
    case 'LanguageTaggedString':
      return graphy.literal(term.value, term.languageTag)
    case 'TypedLiteral':
      return graphy.literal(term.value, toGraphy(term.datatype))
    case 'Quad':
      return graphy.quad(
        toGraphy(term.subject),
        toGraphy(term.predicate),
        toGraphy(term.object),
        toGraphy(term.graph),
      )
    case 'DefaultGraph':
      return graphy.defaultGraph()
    case 'List':
      return pipe(term.values, RA.map(toGraphy), values => [values])
  }
}

const toC3 = (prefixes: {
  [iri: string]: string
}) => (c3: C3, quad: RDF.Quad): C3 => {
  const { subject, predicate, object } = toGraphy(quad)

  const normalisedSubject = subject.concise(prefixes)
  const normalisedPredicate = predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' ? 'a' : predicate.concise(prefixes)

  const predicates: C2 = {
    ...c3?.[normalisedSubject],
    [normalisedPredicate]: Array.prototype.concat(
      c3?.[normalisedSubject]?.[normalisedPredicate] ?? [],
      object,
    )
  }

  return {
    ...c3,
    [normalisedSubject]: Object.keys(predicates).sort().reduce(
      (obj, key) => {
        obj[key] = predicates[key]
        return obj
      },
      {} as C2
    )
  }
}

const writeTo = (stream: Writable) => (prefixes: {
  [key: string]: RDF.NamedNode
}) => (dataset: D.Dataset): T.Task<void> => {
  const graphPrefixes = pipe(
    prefixes,
    RR.map(namespace => namespace.value),
  )

  const writer = turtleWriter({
    prefixes: graphPrefixes,
    style: {
      indent: '  ',
    },
  })
  writer.pipe(stream)

  pipe(
    dataset,
    D.reduce({}, toC3(graphPrefixes)),
    value => writer.write({
      type: 'c3',
      value
    })
  )

  return promisify(() => writer.end())
}

export const writeToFile = flow(
  fs.createWriteStream,
  writeTo,
)
