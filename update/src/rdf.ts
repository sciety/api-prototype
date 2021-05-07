import * as RA from 'fp-ts/ReadonlyArray'
import { concatAll } from 'fp-ts/Semigroup'
import { taskify } from 'fp-ts/TaskEither'
import fs from 'fs'
import * as N3 from 'n3'
import { Quad } from 'rdf-js'

export const { literal, triple } = N3.DataFactory

export { NamedNode, Quad } from 'rdf-js'

export const writeTo = (path: fs.PathLike, options?: N3.WriterOptions) => <Q extends Quad>(quads: Iterable<Q>) => {
  const writer = new N3.Writer(fs.createWriteStream(path), options)
  writer.addQuads([...quads])

  return taskify((...args) => writer.end(...args))()
}

export const concatQuads = concatAll<ReadonlyArray<Quad>>(RA.getSemigroup())(RA.empty)
