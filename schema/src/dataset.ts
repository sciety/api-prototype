import fs from 'fs'
import globby from 'globby'
import $rdf from 'rdf-ext'
import parser from 'rdf-parse'

export const loadDataset = async (filePath: string) => {
  const dataset = $rdf.dataset()

  for await (const file of globby.stream(filePath)) {
    const stream = fs.createReadStream(file)
    const parsed = parser.parse(stream, { path: file.toString() })

    await dataset.import(parsed)
  }

  return dataset
}
