import csvParseSync from 'csv-parse/lib/sync'
import { flow, pipe } from 'fp-ts/function'
import * as d from 'io-ts/Decoder'

const parseCsv = (csv: string) => csvParseSync(csv, { fromLine: 2 })

export const csv = <A>(decoder: d.Decoder<unknown, A>) => pipe(
  d.string,
  d.parse(flow(parseCsv, decoder.decode)),
)
