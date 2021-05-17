import * as E from 'fp-ts/Either'
import { constVoid, flow, pipe } from 'fp-ts/function'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import pLimit from 'p-limit'
import { Browser } from 'puppeteer'
import * as S from './string'

const limit = pLimit(10)

const decodeWith = <A>(decoder: d.Decoder<unknown, A>) => flow(decoder.decode, E.mapLeft(d.draw))

type Response = {
  text: string,
  url: string,
}

export const getFromUrl = (browser: Browser) => (url: string): TE.TaskEither<Error, Response> => () => limit(pipe(
  TE.tryCatch(() => browser.newPage(), E.toError),
  TE.chainFirst(TE.tryCatchK(page => page.setRequestInterception(true, true), E.toError)),
  TE.chainFirstIOK(page => () => page.on('request', request => {
    if (request.resourceType() !== 'document') {
      return request.abort()
    }

    return request.continue()
  })),
  TE.chain(page => pipe(
    TE.tryCatch(() => page.goto(url, { waitUntil: ['networkidle0'] }), E.toError),
    TE.filterOrElse(response => response !== null, () => new Error(`No response found for ${page.url()} (when requesting ${url})`)), // https://github.com/puppeteer/puppeteer/issues/5011
    TE.chain(response => pipe(
      TE.Do,
      TE.apS('text', TE.tryCatch(() => response.text(), E.toError)),
      TE.apSW('url', pipe(response.url(), TE.right)),
    )),
    T.chainFirst(() => TE.tryCatch(() => page.close(), constVoid)),
  )),
))

export const getUrl = (browser: Browser) => <A>(decoder: d.Decoder<unknown, A>) => flow(
  getFromUrl(browser),
  TE.chainEitherKW(response => pipe(
    response.text,
    decodeWith(decoder),
    E.mapLeft(S.prependWith(`Failed to decode ${response.url}:\n`)),
  )),
)
