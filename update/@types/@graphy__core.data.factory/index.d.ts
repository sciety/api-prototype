declare module '@graphy/core.data.factory' {

  type Prefixes = Record<string, string>

  abstract class GenericTerm {
    concise(h_prefixes?: Prefixes): string
  }

  type Subject = NamedNode | BlankNode
  type Predicate = NamedNode
  type Object = NamedNode | BlankNode | GenericLiteral
  type Graph = NamedNode | BlankNode | DefaultGraph

  class Quad extends GenericTerm {
    subject: Subject
    predicate: Predicate
    object: Object
    graph: Graph
  }

  class NamedNode extends GenericTerm {
    value: string

    concise(h_prefixes?: Prefixes): string
  }

  class BlankNode extends GenericTerm {
    value: string
  }

  class GenericLiteral extends GenericTerm {
  }

  class DefaultGraph extends GenericTerm {
  }

  const factory = {
    quad: (subject: Subject, predicate: Predicate, object: Object, graph: Graph) => Quad,
    namedNode: (iri: string) => NamedNode,
    blankNode: (value?: string) => BlankNode,
    literal: (contents: string, datatype_or_lang?: NamedNode | string) => GenericLiteral,
    defaultGraph: () => DefaultGraph,
  }

  export = factory

}
