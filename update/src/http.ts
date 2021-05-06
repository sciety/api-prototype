import axios, { AxiosResponse } from 'axios'
import * as E from 'fp-ts/Either'
import { flow } from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'

const httpGet = TE.tryCatchK<Error, [string], AxiosResponse<string>>(
  (url) => axios.get(url, { responseType: 'text' }),
  E.toError
)

const decodeWith = <A>(decoder: d.Decoder<unknown, A>) => flow(decoder.decode, E.mapLeft(d.draw))

const getFromUrl = flow(httpGet, TE.bimap(String, response => response.data))

export const getUrl = <A>(decoder: d.Decoder<unknown, A>) => flow(getFromUrl, TE.chainEitherK(decodeWith(decoder)))
