declare module '@graphy/content.ttl.write' {

  import { Transform } from 'stream'

  type WriteConfig = Partial<{
    prefixes: {
      [key: string]: string
    }
    style: Partial<{
      indent: string
    }>
  }>

  type ConciseObject = boolean | number | ReadonlyArray<ConciseObjectItem> | ReadonlySet<ConciseObjectItem> | Date

  type ConciseObjectItem = ConciseObject | ReadonlyArray<ConciseObject>

  export type C2 = {
    [predicate: string]: ConciseObject
  }

  export type C3 = {
    [subject: string]: C2
  }

  class Turtle_Writer extends Transform {
    write(chunk: {
      type: 'c3',
      value: C3,
    }): boolean
  }

  const turtleWriter: (writeConfig?: WriteConfig) => Turtle_Writer

  export = turtleWriter

}
