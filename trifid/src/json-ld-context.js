'use strict'

const hijackResponse = require('hijackresponse')
const jsonld = require('jsonld')
const {Readable} = require('stream')
const toString = require('stream-to-string')

const context = {}

const middleware = (req, res, next) => {
  hijackResponse(res, next).then(({destroyAndRestore, readable, writable}) => {
    if ('application/ld+json' !== res.getHeader('Content-Type')) {
      return readable.pipe(writable)
    }

    res.removeHeader('Content-Length')

    return toString(readable)
      .then(JSON.parse)
      .then(doc => jsonld.frame(doc, { '@id': req.iri }, { omitGraph: true }))
      .then(doc => jsonld.compact(doc, context))
      .then(JSON.stringify)
      .then(Readable.from)
      .then(stream => stream.pipe(writable))
      .catch(error => {
        destroyAndRestore()

        return next(error)
      })
  })
};

const factory = () => middleware

module.exports = factory
