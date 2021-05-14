import { flow, pipe } from 'fp-ts/function'
import * as d from 'io-ts/Decoder'

export const json = <A>(decoder: d.Decoder<unknown, A>) => pipe(
  d.string,
  d.parse(flow(JSON.parse, decoder.decode)),
)
