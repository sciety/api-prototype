import axios, { AxiosResponse } from 'axios'
import * as E from 'fp-ts/Either'
import { constant, flow, pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import { ClientRequest } from 'http'
import * as d from 'io-ts/Decoder'

const httpGet = TE.tryCatchK<Error, [string], AxiosResponse<string>>(
  (url) => axios.get(url, { responseType: 'text' }),
  E.toError
)

const decodeWith = <A>(decoder: d.Decoder<unknown, A>) => flow(decoder.decode, E.mapLeft(d.draw))

export const followRedirects = (url: string) => pipe(url, httpGet, TE.bimap(String, flow(
  response => response.request,
  O.fromPredicate((request): request is ClientRequest => request instanceof ClientRequest),
  O.fold(
    constant(url),
    request => `${request.protocol}//${request.host}${request.path}`
  ),
)))

export const getFromUrl = flow(httpGet, TE.bimap(String, response => response.data))

export const getUrl = <A>(decoder: d.Decoder<unknown, A>) => flow(getFromUrl, TE.chainEitherK(decodeWith(decoder)))
