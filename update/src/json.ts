import { flow, pipe } from 'fp-ts/function'
import * as c from 'io-ts/Codec'
import * as d from 'io-ts/Decoder'
import * as e from 'io-ts/Encoder'

export const decoder = <A>(decoder: d.Decoder<unknown, A>) => pipe(
  d.string,
  d.parse(flow(JSON.parse, decoder.decode)),
)

export const encoder = <A>(encoder: e.Encoder<unknown, A>): e.Encoder<string, A> => ({
  encode: value => JSON.stringify(value, undefined, 2)
})

export const Json = <A>(codec: c.Codec<unknown, unknown, A>) => c.make(decoder(codec), encoder(codec))
