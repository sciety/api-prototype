import * as d from './decoder'

export const crossrefWork = d.json(d.struct({
  message: d.struct({
    author: d.array(d.struct({
      given: d.string,
      family: d.string,
    })),
    'container-title': d.array(d.string),
    indexed: d.struct({
      'date-time': d.dateFromIsoString,
    }),
    DOI: d.string,
    language: d.option(d.string),
    publisher: d.string,
    title: d.tuple(d.string),
    URL: d.urlFromString,
  })
}))

export type CrossrefWork = d.TypeOf<typeof crossrefWork>
