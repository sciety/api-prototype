import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import type { PathLike } from 'fs'
import * as fsSync from 'fs'
import * as fs from 'fs/promises'
import { dirname } from 'path'

export const createWriteStream = (path: PathLike) => fsSync.createWriteStream(path)

export const readFile = TE.tryCatchK((path: PathLike) => fs.readFile(path, { encoding: 'utf8' }), E.toError)

export const mkdir = TE.tryCatchK((path: PathLike) => fs.mkdir(path, { recursive: true }), E.toError)

export const writeFile = (path: string) => (data: string) => pipe(
  dirname(path),
  mkdir,
  TE.chain(() => TE.tryCatch(() => fs.writeFile(path, data), E.toError)),
)
