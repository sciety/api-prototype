import crypto from 'crypto'
import { flow, pipe } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'
import { intercalate } from 'fp-ts/Semigroup'
import * as S from 'fp-ts/string'

export * from 'fp-ts/string'

export const md5 = (string: string): IO.IO<string> => () => crypto.createHash('md5').update(string).digest('hex')

export const joinWith = (middle: string) => pipe(S.Semigroup, intercalate(middle))

export const join = flow(joinWith, RNEA.concatAll)

export const split = (separator: string) => (string: string) => string.split(separator)

export const prependWith = (prepended: string) => (string: string) => S.Semigroup.concat(prepended, string)

export const appendWith = (appended: string) => (string: string) => S.Semigroup.concat(string, appended)

export const surroundWith = (prepended: string, appended: string) => flow(
  prependWith(prepended),
  appendWith(appended),
)

export const replaceAll = (pattern: RegExp | string, replacement: string) => (string: string) => {
  return string.replace(new RegExp(pattern, 'g'), replacement)
}
