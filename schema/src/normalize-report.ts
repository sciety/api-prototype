import { rdf, sh } from '@tpluscode/rdf-ns-builders/strict'
import clownface, { AnyContext, AnyPointer } from 'clownface'
import $rdf from 'rdf-ext'
import DatasetExt from 'rdf-ext/lib/Dataset'

// See https://github.com/zazuko/rdf-validate-shacl/blob/652a552b8f2bd2ca469b5a07365ee37225b5abe8/test/data-shapes_tests.js#L116-L171

// As specified in https://w3c.github.io/data-shapes/data-shapes-test-suite/#Validate
export function normalizeReport(report: AnyPointer<AnyContext, DatasetExt>, expectedReport: AnyPointer<AnyContext, DatasetExt>) {
  // Delete messages if expected report doesn't have any
  if (expectedReport.out(sh.result).out(sh.resultMessage).values.length === 0) {
    report.out(sh.result).deleteOut(sh.resultMessage)
  }

  // Split shared blank nodes into distinct blank node structures
  splitSharedBlankNodes(report.dataset)
}

function splitSharedBlankNodes(dataset: DatasetExt) {
  const cf = clownface({ dataset })

  const predicates = [
    sh.resultPath,
    rdf.first,
    rdf.rest,
    sh.alternativePath,
    sh.zeroOrMorePath,
    sh.oneOrMorePath,
    sh.zeroOrOnePath,
    sh.inversePath
  ]

  let moreSharedBlanks = true
  while (moreSharedBlanks) {
    const sharedBlanks = cf
      .out(predicates)
      .filter((obj) => obj.term.termType === 'BlankNode' && obj.in().terms.length > 1)
      .terms

    if (sharedBlanks.length === 0) {
      moreSharedBlanks = false
      continue
    }

    sharedBlanks.forEach((sharedBlank) => {
      // Keep the first link to the shared node intact and split the next ones
      const quadsToSplit = [...dataset.match(null, null, sharedBlank)].slice(1)
      quadsToSplit.forEach((quad) => {
        const newBlank = $rdf.blankNode()

        // Replace quad pointing to shared node to new node
        dataset.remove(quad)
        dataset.add($rdf.quad(quad.subject, quad.predicate, newBlank, quad.graph))

        // Copy shared node structure to new node
        // Nested shared blank nodes will be split in the next iteration
        dataset.match(sharedBlank, null, null).forEach((quad) => {
          dataset.add($rdf.quad(newBlank, quad.predicate, quad.object, quad.graph))
        })
      })
    })
  }
}
