import * as RS from 'fp-ts/ReadonlySet'
import * as S from 'fp-ts/Semigroup'
import * as RDF from './rdf'

export type Dataset = ReadonlySet<RDF.Quad>

export const empty: Dataset = new Set()

export const concatAll = S.concatAll(RS.getUnionMonoid<RDF.Quad>(RDF.eq))(empty)

export const fromArray = RS.fromReadonlyArray<RDF.Quad>(RDF.eq)

export const union = RS.union<RDF.Quad>(RDF.eq)

export const insert = RS.insert<RDF.Quad>(RDF.eq)

export const reduce = RS.reduce<RDF.Quad>(RDF.ord)
