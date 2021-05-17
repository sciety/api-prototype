import * as E from 'fp-ts/Either'
import { constVoid, flow, pipe } from 'fp-ts/function'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import { Browser } from 'puppeteer'

const decodeWith = <A>(decoder: d.Decoder<unknown, A>) => flow(decoder.decode, E.mapLeft(d.draw))

type Response = {
  text: string,
  url: string,
}

export const getFromUrl = (browser: Browser) => (url: string): TE.TaskEither<Error, Response> => pipe(
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
    TE.chainW(response => pipe(
      TE.Do,
      TE.apS('text', TE.tryCatch(() => response.text(), E.toError)),
      TE.apSW('url', pipe(response.url(), TE.right)),
    )),
    T.chainFirst(() => TE.tryCatch(() => page.close(), constVoid)),
  )),
)

export const getUrl = (browser: Browser) => <A>(decoder: d.Decoder<unknown, A>) => flow(
  getFromUrl(browser),
  TE.chainEitherKW(flow(
    response => response.text,
    decodeWith(decoder),
  )),
)
