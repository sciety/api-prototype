declare module 'rdf-utils-dataset' {

  import * as RDF from 'rdf-js'
  import DatasetExt from 'rdf-ext/lib/Dataset';

  export const resource: <OutQuad extends RDF.BaseQuad = RDF.Quad, InQuad extends RDF.BaseQuad = RDF.Quad, D extends DatasetExt<OutQuad, InQuad>>(input: D, subject: OutQuad['subject']) => D
}
