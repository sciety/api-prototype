import * as Eq from 'fp-ts/Eq'
import { pipe } from 'fp-ts/function'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import { taskify } from 'fp-ts/TaskEither'
import fs from 'fs'
import * as N3 from 'n3'

export type NamedNode<Iri extends string = string> = {
  readonly type: 'NamedNode'
  readonly value: Iri
}

export type BlankNode = {
  readonly type: 'BlankNode'
  readonly name: string
}

export type LanguageTaggedString = {
  readonly type: 'LanguageTaggedString'
  readonly value: string
  readonly languageTag: string
  readonly datatype: NamedNode<'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'>
}

export type TypedLiteral<Type extends string = string> = {
  readonly type: 'TypedLiteral'
  readonly value: string
  readonly datatype: NamedNode<Type>
}

export type Literal<Type extends string = string> = LanguageTaggedString | TypedLiteral<Type>

export type Quad = {
  readonly type: 'Quad'
  readonly subject: Subject
  readonly predicate: Predicate
  readonly object: Object
  readonly graph: Graph
}

export type DefaultGraph = {
  readonly type: 'DefaultGraph'
}

export type List = {
  readonly type: 'List'
  readonly values: ReadonlyArray<Object>
}

export type Subject = NamedNode | BlankNode | Quad

export type Predicate = NamedNode

export type Object = NamedNode | Literal | BlankNode | Quad | List

export type Graph = DefaultGraph | NamedNode | BlankNode

export type Term = Subject | Predicate | Object | Graph

export const namedNode = <T extends string>(value: T): NamedNode<T> => ({
  type: 'NamedNode',
  value,
})

export const blankNode = (name?: string): BlankNode => ({
  type: 'BlankNode',
  name: N3.DataFactory.blankNode(name).value,
})

export const languageTaggedString = (value: string, languageTag: string): LanguageTaggedString => ({
  type: 'LanguageTaggedString',
  value,
  languageTag,
  datatype: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'),
})

export function typedLiteral<T extends string>(value: string, datatype: NamedNode<T>): TypedLiteral<T> {
  return {
    type: 'TypedLiteral',
    value,
    datatype,
  }
}

export const date = (value: Date) => typedLiteral(value.toISOString().substring(0, 10), namedNode('http://www.w3.org/2001/XMLSchema#date'))

export const literal = (value: string) => typedLiteral(value, namedNode('http://www.w3.org/2001/XMLSchema#string'))

export const defaultGraph: DefaultGraph = {
  type: 'DefaultGraph',
}

export const list = (values: ReadonlyArray<Object>): List => ({
  type: 'List',
  values,
})

export const triple = (subject: Subject, predicate: Predicate, object: Object) => quad(subject, predicate, object, defaultGraph)

export const quad = (subject: Subject, predicate: Predicate, object: Object, graph: Graph): Quad => ({
  type: 'Quad',
  subject,
  predicate,
  object,
  graph,
})

const toRdfJs = (writer: N3.Writer) => (term: Term): any => {
  switch (term.type) {
    case 'NamedNode':
      return N3.DataFactory.namedNode(term.value)
    case 'BlankNode':
      return N3.DataFactory.blankNode(term.name)
    case 'LanguageTaggedString':
      return N3.DataFactory.literal(term.value, term.languageTag)
    case 'TypedLiteral':
      return N3.DataFactory.literal(term.value, toRdfJs(writer)(term.datatype))
    case 'Quad':
      return N3.DataFactory.quad(toRdfJs(writer)(term.subject), toRdfJs(writer)(term.predicate), toRdfJs(writer)(term.object), toRdfJs(writer)(term.graph))
    case 'DefaultGraph':
      return N3.DataFactory.defaultGraph()
    case 'List':
      return pipe(term.values, RA.map(toRdfJs(writer)), ([...values]) => writer.list(values))
  }
}

export const writeTo = (path: fs.PathLike, options: {
  format: 'turtle'
  prefixes?: {
    [key: string]: NamedNode
  }
}) => (quads: Iterable<Quad>) => {
  const n3prefixes = pipe(
    options.prefixes ?? {},
    RR.map(namespace => namespace.value),
  )

  const writer = new N3.Writer(fs.createWriteStream(path), { ...options, prefixes: n3prefixes })

  writer.addQuads([...quads].map(toRdfJs(writer)))

  return taskify((...args) => writer.end(...args))()
}

export const eq: { equals: <T extends Term>(a: T, b: T) => boolean } = Eq.eqStrict
