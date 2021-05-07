import { flow, pipe } from 'fp-ts/function'
import { concatAll, intercalate } from 'fp-ts/Semigroup'
import * as S from 'fp-ts/string'

export * from 'fp-ts/string'

export const joinWith = (middle: string) => pipe(S.Semigroup, intercalate(middle))

export const joinAllWith = flow(joinWith, concatAll)

export const join = (middle: string) => pipe(S.empty, joinAllWith(middle))
