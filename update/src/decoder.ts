import csvParseSync from 'csv-parse/lib/sync'
import * as A from 'fp-ts/Array'
import * as E from 'fp-ts/Either'
import { flow, pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as d from 'io-ts/Decoder'

export * from 'io-ts/Decoder'

export const decodeWith = <A>(decoder: d.Decoder<unknown, A>) => flow(decoder.decode, E.mapLeft(d.draw))

export const doiFromNAString = pipe(
  d.string,
  d.parse(flow(
    O.fromPredicate(value => value !== 'NA'),
    d.success,
  )),
)

export const nonEmptyArray = flow(
  d.array,
  d.refine(A.isNonEmpty, 'nonEmptyArray'),
)

export const dateFromIsoString: d.Decoder<unknown, Date> = pipe(
  d.string,
  d.parse(value => {
    const date = new Date(value)
    return isNaN(date.getTime()) ? d.failure(value, 'dateFromIsoString') : d.success(date)
  })
)

export const json = <A>(decoder: d.Decoder<unknown, A>) => pipe(
  d.string,
  d.parse(flow(JSON.parse, decoder.decode)),
)

const parseCsv = (csv: string) => csvParseSync(csv, { fromLine: 2 })

export const csv = <A>(decoder: d.Decoder<unknown, A>) => pipe(
  d.string,
  d.parse(flow(parseCsv, decoder.decode)),
)
