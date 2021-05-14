import * as E from 'fp-ts/Either'
import { flow, pipe } from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import { Browser } from 'puppeteer'

const decodeWith = <A>(decoder: d.Decoder<unknown, A>) => flow(decoder.decode, E.mapLeft(d.draw))

export const getFromUrl = (browser: Browser) => (url: string) => pipe(
  TE.tryCatch(() => browser.newPage(), E.toError),
  TE.chainFirst(TE.tryCatchK(page => page.setRequestInterception(true, true), E.toError)),
  TE.chainFirstIOK(page => () => page.on('request', request => {
    if (request.resourceType() !== 'document') {
      return request.abort()
    }

    return request.continue()
  })),
  TE.chain(TE.tryCatchK(page => page.goto(url, { waitUntil: 'networkidle0' }), E.toError)),
)

export const getUrl = (browser: Browser) => <A>(decoder: d.Decoder<unknown, A>) => flow(
  getFromUrl(browser),
  TE.chain(TE.tryCatchK(response => response.text(), E.toError)),
  TE.chainEitherKW(decodeWith(decoder)),
)
