import * as A from 'fp-ts/Array'
import { flow, pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as d from 'io-ts/Decoder'
import * as json from './json'

const doiFromNAString = pipe(
  d.string,
  d.parse(flow(
    O.fromPredicate(value => value !== 'NA'),
    d.success,
  )),
)

const nonEmptyArray = flow(
  d.array,
  d.refine(A.isNonEmpty, 'nonEmptyArray'),
)

const biorxivArticleVersion = d.struct({
  date: d.string,
  doi: d.string,
  title: d.string,
  version: d.string,
  published: doiFromNAString,
  server: d.union(d.literal('biorxiv'), d.literal('medrxiv')),
})

export const biorxivArticleDetails = json.decoder(d.struct({
  collection: nonEmptyArray(biorxivArticleVersion)
}))

export type BiorxivArticleDetails = d.TypeOf<typeof biorxivArticleDetails>

export type BiorxivArticleVersion = d.TypeOf<typeof biorxivArticleVersion>
