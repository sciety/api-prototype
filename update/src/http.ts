import * as E from 'fp-ts/Either'
import { constant, constVoid, flow, pipe } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as O from 'fp-ts/Option'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import parseMetaRefresh from 'http-equiv-refresh'
import * as c from 'io-ts/Codec'
import { JSDOM } from 'jsdom'
import pLimit from 'p-limit'
import path from 'path'
import { Browser, Page } from 'puppeteer'
import * as d from './decoder'
import * as fs from './fs'
import { Json } from './json'
import * as S from './string'

const limit = pLimit(5)

type Response = {
  text: string,
  url: string,
}

const response = Json(c.struct({
  text: c.string,
  url: c.string,
}))

const goToUrl = (url: string) => (page: Page): TE.TaskEither<Error, Response> => pipe(
  TE.tryCatch(() => page.goto(url), E.toError),
  TE.filterOrElse(response => response !== null, () => new Error(`No response found for ${page.url()} (when requesting ${url})`)), // https://github.com/puppeteer/puppeteer/issues/5011
  TE.filterOrElse(response => response.ok(), response => new Error(`Received a ${response.status()} ${response.statusText()} response for ${response.url()} (when requesting ${url})`)),
  TE.chain(response => pipe(
    TE.Do,
    TE.apS('text', TE.tryCatch(() => response.text(), E.toError)),
    TE.apSW('url', pipe(response.url(), TE.right)),
  )),
  TE.chain(response => pipe(
    JSDOM.fragment(response.text).querySelector('meta[http-equiv=refresh]')?.getAttribute('content'),
    O.fromNullable,
    O.chain(flow(
      parseMetaRefresh,
      ({ url }) => url,
      O.fromNullable,
      O.map(redirect => new URL(redirect, response.url).toString()),
    )),
    O.match(
      constant(TE.right(response)),
      redirect => goToUrl(redirect)(page)
    ),
  )),
)

const reallyGetFromUrl = (browser: Browser) => (url: string): TE.TaskEither<Error, Response> => () => limit(pipe(
  TE.tryCatch(() => browser.newPage(), E.toError),
  TE.chainFirst(TE.tryCatchK(page => page.setRequestInterception(true, true), E.toError)),
  TE.chainFirst(TE.tryCatchK(page => page.setJavaScriptEnabled(false), E.toError)),
  TE.chainFirstIOK(page => () => page.on('request', request => {
    if (request.resourceType() !== 'document') {
      return request.abort()
    }

    return request.continue()
  })),
  TE.chain(page => pipe(
    page,
    goToUrl(url),
    T.chainFirst(() => TE.tryCatch(() => page.close(), constVoid)),
  ))
))

const toCacheFilePath = flow(
  S.md5,
  IO.map(S.surroundWith(path.join(__dirname, '../cache/local/'), '.json')),
)

export const getFromUrl = (browser: Browser) => (url: string): TE.TaskEither<Error, Response> => pipe(
  url,
  toCacheFilePath,
  TE.rightIO,
  TE.chain(cacheFile => pipe(
    cacheFile,
    fs.readFile,
    TE.chainEitherKW(d.decodeWith(response)),
    TE.altW(() => reallyGetFromUrl(browser)(url)),
    TE.chainFirstW(flow(
      response.encode,
      fs.writeFile(cacheFile),
    )),
  )),
)

export const getUrl = (browser: Browser) => <A>(decoder: d.Decoder<unknown, A>) => flow(
  getFromUrl(browser),
  TE.chainEitherKW(response => pipe(
    response.text,
    d.decodeWith(decoder),
    E.mapLeft(S.prependWith(`Failed to decode ${response.url}:\n`)),
  )),
)
