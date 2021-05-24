'use strict'

const hijackResponse = require('hijackresponse')
const jsonld = require('jsonld')
const {Readable} = require('stream')
const toString = require('stream-to-string')
const context = require('./context.json')

const middleware = (req, res, next) => {
  hijackResponse(res, next).then(({destroyAndRestore, readable, writable}) => {
    if (!(res.getHeader('Content-Type')?.startsWith('application/ld+json'))) {
      return readable.pipe(writable)
    }

    const contextUrl = new URL('/context.jsonld', req.absoluteUrl()).toString()

    const contextsLoader = async (url) => {
      if (url === contextUrl) {
        return {
          contextUrl: null,
          document: context,
          documentUrl: url,
        };
      }

      return jsonld.documentLoaders.node()(url);
    };

    res.removeHeader('Content-Length')

    return toString(readable)
      .then(JSON.parse)
      .then(doc => jsonld.frame(doc, { '@id': req.iri }, { omitGraph: true }))
      .then(doc => jsonld.compact(doc, contextUrl, { documentLoader: contextsLoader }))
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
