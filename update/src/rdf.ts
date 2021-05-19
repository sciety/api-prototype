import * as graphy from '@graphy/core.data.factory'
import * as Eq from 'fp-ts/Eq'
import { pipe } from 'fp-ts/function'
import { concatAll } from 'fp-ts/Monoid'
import * as Ord from 'fp-ts/Ord'
import * as RA from 'fp-ts/ReadonlyArray'
import { URL } from 'url'
import * as S from './string'

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
  name: name ?? graphy.blankNode().name,
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

export const url = (value: URL) => typedLiteral(value.toString(), namedNode('http://www.w3.org/2001/XMLSchema#anyURI'))

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

const getOrd = (type: Term['type']): Ord.Ord<any> => {
  switch (type) {
    case 'NamedNode':
      return ordNamedNode
    case 'BlankNode':
      return ordBlankNode
    case 'LanguageTaggedString':
      return ordLanguageTaggedString
    case 'TypedLiteral':
      return ordTypedLiteral
    case 'Quad':
      return ordQuad
    case 'DefaultGraph':
      return Ord.fromCompare(() => 0)
    case 'List':
      return Ord.fromCompare(() => 0)
  }
}

export const ord: Ord.Ord<Term> = Ord.fromCompare((x, y) => {
  if (x.type === y.type) {
    return getOrd(x.type).compare(x, y)
  }

  return 0
})

const ordBlankNode = Ord.contramap((term: BlankNode) => term.name)(S.Ord)
const ordLanguageTaggedString = Ord.contramap((term: LanguageTaggedString) => term.value)(S.Ord)
const ordNamedNode = Ord.contramap((term: NamedNode) => term.value)(S.Ord)

const ordTypedLiteral: Ord.Ord<TypedLiteral> = concatAll(Ord.getMonoid<TypedLiteral>())([
  Ord.contramap((term: TypedLiteral) => term.datatype)(ordNamedNode),
  Ord.contramap((term: TypedLiteral) => term.value)(S.Ord),
])

const ordQuad: Ord.Ord<Quad> = concatAll(Ord.getMonoid<Quad>())([
  Ord.contramap((term: Quad) => term.graph)(ord),
  Ord.contramap((term: Quad) => term.subject)(ord),
  Ord.contramap((term: Quad) => term.predicate)(ord),
  Ord.contramap((term: Quad) => term.object)(ord),
])

export const eq: { equals: <T extends Term>(a: T, b: T) => boolean } = Eq.fromEquals((x, y) => {
  switch (x.type) {
    case 'NamedNode':
      return y.type === 'NamedNode' && eqNamedNode.equals(x, y)
    case 'BlankNode':
      return y.type === 'BlankNode' && eqBlankNode.equals(x, y)
    case 'LanguageTaggedString':
      return y.type === 'LanguageTaggedString' && eqLanguageTaggedString.equals(x, y)
    case 'TypedLiteral':
      return y.type === 'TypedLiteral' && eqTypedLiteral.equals(x, y)
    case 'Quad':
      return y.type === 'Quad' && eqQuad.equals(x, y)
    case 'DefaultGraph':
      return y.type === 'DefaultGraph'
    case 'List':
      return y.type === 'List' && eqList.equals(x, y)
  }
})

const eqNamedNode: Eq.Eq<NamedNode> = pipe(S.Eq, Eq.contramap(term => term.value))

const eqBlankNode: Eq.Eq<BlankNode> = pipe(S.Eq, Eq.contramap(term => term.name))

const eqLanguageTaggedString: Eq.Eq<LanguageTaggedString> = Eq.struct({
  value: S.Eq,
  languageTag: S.Eq,
})

const eqTypedLiteral: Eq.Eq<TypedLiteral> = Eq.struct({
  value: S.Eq,
  datatype: eq,
})

const eqQuad: Eq.Eq<Quad> = Eq.struct({
  subject: eq,
  predicate: eq,
  object: eq,
  graph: eq,
})

const eqList: Eq.Eq<List> = pipe(RA.getEq(eq), Eq.contramap(term => term.values))
