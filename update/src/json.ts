import * as c from 'io-ts/Codec'
import * as e from 'io-ts/Encoder'
import * as d from './decoder'

export const encoder = <A>(encoder: e.Encoder<unknown, A>): e.Encoder<string, A> => ({
  encode: value => JSON.stringify(value, undefined, 2)
})

export const Json = <A>(codec: c.Codec<unknown, unknown, A>) => c.make(d.json(codec), encoder(codec))
