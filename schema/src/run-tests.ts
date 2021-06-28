import { rdf, sh } from '@tpluscode/rdf-ns-builders/strict'
import clownface from 'clownface'
import fs from 'fs'
import globby from 'globby'
import $rdf from 'rdf-ext'
import parser from 'rdf-parse'
import { resource } from 'rdf-utils-dataset'
import SHACLValidator from 'rdf-validate-shacl'
import test from 'tape'
import { normalizeReport } from './normalize-report'

type TestRunner = (options: {
  testCases: string,
  shapes: string,
}) => Promise<void>

const loadDataset = async (filePath: string) => {
  const dataset = $rdf.dataset()

  for await (const file of globby.stream(filePath)) {
    const stream = fs.createReadStream(file)
    const parsed = parser.parse(stream, { path: file.toString() })

    await dataset.import(parsed)
  }

  return clownface({ dataset })
}

export const runTest: TestRunner = async options => {
  const shapes = await loadDataset(options.shapes)
  const validator = new SHACLValidator(shapes.dataset, { factory: $rdf })

  for await (const path of globby.stream(options.testCases)) {
    test(path.toString(), async assert => {
      const testCase = await loadDataset(path.toString())

      const expectedReport = testCase
        .node(sh.ValidationReport)
        .in(rdf.type)

      const term = expectedReport.term

      if (!term) {
        return assert.end('no sh:ValidationReport found')
      }

      const expectedConforms = expectedReport.out(sh.conforms).value === 'true'
      const expectedDataset = resource(expectedReport.dataset, term)

      const report = clownface({ dataset: validator.validate(testCase.dataset).dataset })
        .node(sh.ValidationReport)
        .in(rdf.type)
      const conforms = report.out(sh.conforms).value === 'true'

      if (expectedConforms) {
        assert.true(conforms, 'should conform')

        return assert.end()
      }

      assert.false(conforms, 'should not conform')

      if (conforms) {
        return assert.end()
      }

      normalizeReport(report, expectedReport)

      assert.equal(report.dataset.toCanonical(), expectedDataset.toCanonical(), 'should have matching validation reports')

      return assert.end()
    })
  }
}
