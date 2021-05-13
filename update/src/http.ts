import axios, { AxiosResponse } from 'axios'
import { setupCache } from 'axios-cache-adapter'
import crypto from 'crypto'
import * as E from 'fp-ts/Either'
import { constant, flow, pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import * as fs from 'fs/promises'
import { ClientRequest } from 'http'
import * as d from 'io-ts/Decoder'
import path from 'path'

class FilesystemStore {
  private readonly store

  constructor() {
    this.store = path.join(__dirname, '../cache')
  }

  async getItem(key: string) {
    return fs.readFile(this.file(key), { encoding: 'utf8' })
      .then(JSON.parse)
      .catch(() => null)
  }

  async setItem(key: string, value: unknown) {
    return this.createStore()
      .then(() => fs.writeFile(this.file(key), JSON.stringify(value)))
      .then(() => value)
  }

  async removeItem(key: string) {
    return fs.rm(this.file(key))
  }

  async clear() {
    return fs.rmdir(this.store)
  }

  private async createStore() {
    return fs.mkdir(this.store, { recursive: true })
  }

  private file(key: string) {
    const filename = crypto.createHash('md5').update(key).digest('hex')

    return path.join(this.store, `${filename}.json`)
  }
}

const cache = setupCache({
  maxAge: 15 * 60 * 1000,
  store: new FilesystemStore(),
})

const client = axios.create({ adapter: cache.adapter })

const httpGet = TE.tryCatchK<Error, [string], AxiosResponse<string>>(
  (url) => client.get(url, { responseType: 'text' }),
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
