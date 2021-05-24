'use strict'

const hijackResponse = require('hijackresponse')
const jsonld = require('jsonld')
const {Readable} = require('stream')
const toString = require('stream-to-string')

const contexts = {
  'http://localhost:8080/context.jsonld': require('./context.json')
};

const nodeDocumentLoader = jsonld.documentLoaders.node();

const contextsLoader = async (url) => {
  if (url in contexts) {
    return {
      contextUrl: null,
      document: contexts[url],
      documentUrl: url,
    };
  }

  return nodeDocumentLoader(url);
};

const middleware = (req, res, next) => {
  hijackResponse(res, next).then(({destroyAndRestore, readable, writable}) => {
    if (!(res.getHeader('Content-Type')?.startsWith('application/ld+json'))) {
      return readable.pipe(writable)
    }

    res.removeHeader('Content-Length')

    return toString(readable)
      .then(JSON.parse)
      .then(doc => jsonld.frame(doc, { '@id': req.iri }, { omitGraph: true }))
      .then(doc => jsonld.compact(doc, 'http://localhost:8080/context.jsonld', { documentLoader: contextsLoader }))
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
