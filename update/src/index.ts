import { log } from 'fp-ts/Console'
import { pipe } from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import * as d from 'io-ts/Decoder'
import { csv } from './csv'
import { getUrl } from './http'
import { exit } from './process'

const reviews = csv(d.array(d.tuple(
  d.string,
  d.string,
  d.string,
)))

pipe(
  'https://github.com/sciety/sciety/raw/main/data/reviews/4eebcec9-a4bb-44e1-bde3-2ae11e65daaa.csv',
  getUrl(reviews),
  TE.chainFirstIOK(log),
  exit,
)()
