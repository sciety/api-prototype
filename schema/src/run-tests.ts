import { rdf, sh } from '@tpluscode/rdf-ns-builders/strict'
import clownface from 'clownface'
import globby from 'globby'
import $rdf from 'rdf-ext'
import { resource } from 'rdf-utils-dataset'
import SHACLValidator from 'rdf-validate-shacl'
import test from 'tape'
import { loadDataset } from './dataset'
import { normalizeReport } from './normalize-report'

type TestRunner = (options: {
  testCases: string,
  shapes: string,
}) => Promise<void>

export const runTest: TestRunner = async options => {
  const shapes = await loadDataset(options.shapes)
  const validator = new SHACLValidator(shapes, { factory: $rdf })

  for await (const path of globby.stream(options.testCases)) {
    test(path.toString(), async assert => {
      const dataset = (await loadDataset(path.toString())).merge(shapes)
      const testCase = clownface({ dataset })

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
