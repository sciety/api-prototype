import { flow, pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Ord from 'fp-ts/Ord'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'
import intoStream from 'into-stream'
import { Store } from 'n3'
import { BaseQuad, DatasetCore, Stream } from 'rdf-js'
import * as RDF from './rdf'

export type { DatasetCore } from 'rdf-js'

const toStream = <T extends BaseQuad>(values: ReadonlyArray<T>): Stream<T> => intoStream.object(values)

const addAll = <B extends RDF.BaseQuad, A extends RDF.BaseQuad, C extends A, D extends DatasetCore<B, A>>([dataset, sets]: Readonly<[D, Iterable<Iterable<C>>]>) => {
  for (const set of sets) {
    for (const quad of set) {
      if (dataset.has(quad)) {
        continue
      }

      dataset.add(quad)
    }
  }

  return dataset
}

export const concatAll = <B extends RDF.BaseQuad, A extends RDF.BaseQuad>(datasets: ReadonlyArray<DatasetCore<B, A>>): DatasetCore<B, A> => pipe(
  datasets,
  RNEA.fromReadonlyArray,
  O.map(flow(
    RNEA.unprepend,
    addAll,
  )),
  O.getOrElseW(() => new Store() as any),
)

export const fromArray = <A extends RDF.BaseQuad>(quads: ReadonlyArray<A>): DatasetCore<A, A> => new Store([...quads]) as any

export const union = <B extends RDF.BaseQuad, A extends RDF.BaseQuad, D extends DatasetCore<B, A>>(dataset: D) => <C extends A>(quads: DatasetCore<C, RDF.BaseQuad>) => (
  addAll([dataset, [quads]])
)

export const insert = <A extends RDF.BaseQuad>(quad: A) => <B extends RDF.BaseQuad, D extends DatasetCore<B, A>>(dataset: D) => dataset.add(quad)

export const toArray = <A extends RDF.BaseQuad>(ord: Ord.Ord<A>) => (dataset: DatasetCore<A>) => pipe(
  [...dataset],
  RA.sort(ord),
)

export const toStreamMap = <A extends BaseQuad, B extends BaseQuad = A>(ord: Ord.Ord<A>, map: (a: A) => B) => flow(
  toArray(ord),
  RA.map(map),
  toStream,
)
