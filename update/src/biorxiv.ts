import * as d from 'io-ts/Decoder'
import { json } from './json'

const biorxivArticleVersion = d.struct({
  date: d.string,
  doi: d.string,
  title: d.string,
  version: d.string,
})

export const biorxivArticleDetails = json(d.struct({
  collection: d.array(biorxivArticleVersion)
}))

export type BiorxivArticleVersion = d.TypeOf<typeof biorxivArticleVersion>
