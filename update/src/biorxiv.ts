import * as d from './decoder'

const biorxivArticleVersion = d.struct({
  date: d.dateFromIsoString,
  doi: d.string,
  title: d.string,
  version: d.string,
  published: d.doiFromNAString,
  server: d.union(d.literal('biorxiv'), d.literal('medrxiv')),
})

export const biorxivArticleDetails = d.json(d.struct({
  collection: d.nonEmptyArray(biorxivArticleVersion)
}))

export type BiorxivArticleDetails = d.TypeOf<typeof biorxivArticleDetails>
