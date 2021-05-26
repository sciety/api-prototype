import { concatAll } from 'fp-ts/Monoid'
import * as Ord from 'fp-ts/Ord'
import { DataFactory } from 'n3'
import { BaseQuad, BlankNode, Literal, NamedNode, Quad, Term, Variable } from 'rdf-js'
import { rdf, xsd } from './namespace'
import * as S from './string'

export const { namedNode, literal, quad } = DataFactory

export type {
  Term, NamedNode, BlankNode, Literal, Variable, DefaultGraph, BaseQuad, Quad
} from 'rdf-js'

export const date = (value: Date) => literal(value.toISOString().substring(0, 10), xsd.date)

export const url = (value: URL) => literal(value.toString(), xsd.anyURI)

const getOrd = (type: Term['termType']): Ord.Ord<any> => {
  switch (type) {
    case 'NamedNode':
      return ordNamedNode
    case 'BlankNode':
      return ordBlankNode
    case 'Literal':
      return ordLiteral
    case 'Variable':
      return ordVariable
    case 'DefaultGraph':
      return Ord.fromCompare(() => 0)
    case 'Quad':
      return ordQuad
  }
}

export const ord: Ord.Ord<Term> = Ord.fromCompare((x, y) => {
  if (x.termType === y.termType) {
    return getOrd(x.termType).compare(x, y)
  }

  return 0
})

const ordBlankNode = Ord.contramap((term: BlankNode) => term.value)(S.Ord)
const ordLiteral = Ord.contramap((term: Literal) => term.value)(S.Ord)
const ordNamedNode = Ord.fromCompare<NamedNode>((x, y) => {
  if (x.equals(rdf.type)) {
    return -1
  }
  if (y.equals(rdf.type)) {
    return 1
  }
  return S.Ord.compare(x.value, y.value)
})
const ordVariable = Ord.contramap((term: Variable) => term.value)(S.Ord)

const ordQuad: Ord.Ord<BaseQuad> = concatAll(Ord.getMonoid<BaseQuad>())([
  Ord.contramap((term: BaseQuad) => term.graph)(ord),
  Ord.contramap((term: BaseQuad) => term.subject)(ord),
  Ord.contramap((term: BaseQuad) => term.predicate)(ord),
  Ord.contramap((term: BaseQuad) => term.object)(ord),
])

export const toTriple = <A extends BaseQuad>({
  subject,
  predicate,
  object
}: A): A => DataFactory.triple<A>(subject, predicate, object) as any
