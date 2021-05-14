import { flow, pipe } from 'fp-ts/function'
import * as d from 'io-ts/Decoder'
import * as O from 'fp-ts/Option'
import { json } from './json'

const doiFromNAString = pipe(
  d.string,
  d.parse(flow(
    O.fromPredicate(value => value !== 'NA'),
    d.success,
  )),
)

const biorxivArticleVersion = d.struct({
  date: d.string,
  doi: d.string,
  title: d.string,
  version: d.string,
  published: doiFromNAString,
})

export const biorxivArticleDetails = json(d.struct({
  collection: d.array(biorxivArticleVersion)
}))

export type BiorxivArticleVersion = d.TypeOf<typeof biorxivArticleVersion>
