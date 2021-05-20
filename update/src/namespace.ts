import * as RDF from './rdf'

type NamespaceBuilder<A extends string, T extends string = string> = {
  <B extends string>(property: B): RDF.NamedNode<`${A}${B}`>
  (): RDF.NamedNode<A>
  [key: string]: RDF.NamedNode<`${A}${typeof key}`>
}

function namespace<A extends string>(namespace: A): NamespaceBuilder<A> {
  const builder = (term?: string) => RDF.namedNode(`${namespace}${term ?? ''}`)

  return new Proxy(builder, {
    apply: (target, thisArg, args) => target(args[0]),
    get: (target, property) => target(property.toString()),
  }) as any
}

export const cito = namespace('http://purl.org/spar/cito/')

export const dcterms = namespace('http://purl.org/dc/terms/')

export const fabio = namespace('http://purl.org/spar/fabio/')

export const foaf = namespace('http://xmlns.com/foaf/0.1/')

export const frbr = namespace('http://purl.org/vocab/frbr/core#')

export const org = namespace('http://www.w3.org/ns/org#')

export const rdf = namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')

export const rdfs = namespace('http://www.w3.org/2000/01/rdf-schema#')

export const sciety = namespace('http://localhost:8080/')

export const xsd = namespace('http://www.w3.org/2001/XMLSchema#')
