import * as S from 'fp-ts/string'

export * from 'fp-ts/string'

export const prependWith = (prepended: string) => (string: string) => S.Semigroup.concat(prepended, string)
