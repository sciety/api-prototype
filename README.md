# Sciety API experimentation

## About

This repo contains an experiment into creating an API using [RDF](https://en.wikipedia.org/wiki/Resource_Description_Framework) for integration between [Sciety], [bioRxiv] and others.

It makes use of the [Spar Ontologies], especially [FRBR-aligned Bibliographic Ontology (FaBiO)](FaBiO).

## Getting started

> This requires [Docker Compose]

The [Turtle] files in [`data`](./data) contain RDF statements describing articles, their versions, and their evaluations.

To start the applications:

1. Run `docker-compose up`
2. In a separate terminal run `docker-compose exec blazegraph /load-data.sh` (this will succeed once both the container and application have started)

A [Trifid] server is then available at <http://localhost:8080> to view the resources. This also has:

- a SPARQL editor at <http://localhost:8080/sparql/>, which uses [Yasgui].
- a view on the structure at <http://localhost:8080/spex/>, which uses [SPEX].
- a graph explorer at <http://localhost:8080/graph-explorer/>, which uses [Graph Explorer].

This is read from a [SPARQL] endpoint provided by a [Blazegraph] instance available at <http://localhost:8081/>.

There is also a basic client querying and display information about articles and their evaluations at <http://localhost:8082>.

## RDF

> People think RDF is a pain because it is complicated. The truth is even worse. RDF is painfully simplistic, but it allows you to work with real-world data and problems that are horribly complicated.
>
> --- <cite>[Dan Brickley and Libby Miller][RDF is a pain]</cite>

[Doc Maps] describes 'three key requirements for representations of editorial processes in a healthy publishing ecosystem':

> Extensibility: the framework should be capable of representing a wide range of editorial process events, ranging from a simple assertion that a review occurred to a complete history of editorial comments on a document to a standalone review submitted by an independent reviewer

RDF provides a simple framework for representing information; there is a wide range of existing vocabularies for describing [publishing workflows][PWO], [publish-able works][FaBiO], [organisations][ORG], [people][FOAF], [biomedical investigations][OBI]...

The proposed [DocMaps Framework] appears to be based on JSON, which involves inventing new terms rather than being able to use existing, well-developed and tested vocabularies. Furthermore, plain JSON/XML representations usually struggle to scale to sufficiently describe the variations in the real world. (This can sometimes result in processes being limited to what the format can achieve, rather than it describing what's happening.)

> Machine-readability: the framework should be represented in a format (eg XML) that can be interpreted computationally and translated into visual representations.

RDF is an abstract model that has multiple formats available. They include [JSON-LD] and [RDF/XML], which provide access to RDF in formats already familiar to developers.

>Discoverability: the framework should be publishable such that events are queryable and discoverable via a variety of well-supported mechanisms.

[SPARQL] is a [W3C] recommendation and has become the standard RDF query language.

## Modelling

### Articles

This makes use of the first 3 levels of [Functional Requirements for Bibliographic Records (FRBR)](FRBR) in order to separate _where_ and _how_ an article is published from the article itself:

![][FRBR Diagram]

An article (_work_) can be published in multiple places (_expressions_), where it can have multiple formats (_manifestation_). Individual copies of these (_item_) don't need to be modelled here.

For example, for an article first published on bioRxiv then eLife:

```text
                               ┌───────────────────────┐
                               │                       │
Work                           │        Article        │
                               │                       │
                               └───────────┬───────────┘
                                           │
                           ┌───────────────┼───────────────────────┐
                           │               │                       │
                           │               │                       │
                     ┌─────▼──────┐  ┌─────▼──────┐          ┌─────▼──────┐
                     │            │  │            │          │            │
Expression           │ bioRxiv v1 │  │ bioRxiv v2 │          │  eLife v1  │
                     │            │  │            │          │            │
                     └─────┬──────┘  └─────┬──────┘          └─────┬──────┘
                           │               │                       │
                      ┌────┴──┐        ┌───┴───┐       ┌───────┬───┴────┬───────┐
                      │       │        │       │       │       │        │       │
                   ┌──▼──┐ ┌──▼──┐  ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌───▼──┐ ┌──▼──┐
Manifestation      │ Web │ │ PDF │  │ Web │ │ PDF │ │ Web │ │ PDF │ │ Lens │ │ ERA │
                   └─────┘ └─────┘  └─────┘ └─────┘ └─────┘ └─────┘ └──────┘ └─────┘
```

### Evaluations

An evaluation, be it a review, recommendation or something else, links to the appropriate class.

A review by Peer Community in Ecology, for example, would apply to a single _expression_. That is, it covers its various formats, but not other versions of the article. A subsequent recommendation by PCI Ecology applies to _both_ an _expression_ and the _work_ itself. That is, the recommendation of the article covers all other versions.

A recommendation by Peer Community in Ecology, however, could apply to the _work_ itself. This recommendation still applies to future publication in a journal.

```text
       ┌────────────────┐      ┌───────────────────────┐     ┌────────────────┐
       │   PCI Ecology  ├──────►                       ◄─────┤    eLife       ◄──┐
       │ Recommendation ├──┐   │        Article        │     │ Recommendation │  │
       └──▲─────────────┘  │   │                       │     └────────┬───────┘  │
          │                │   └───────────┬───────────┘              │        ┌─┴───────┐
          │                └──────────┐    │                          │       ┌┴────────┐│
          │                ┌──────────┼────┼───────────────────────┐  │       │  eLife  ││
          │                │          │    │    ┌──────────────────┼──┼───────┤ Reviews ├┘
 ┌────────┴──┐             │          │    │    │                  │  │       └─────────┘
┌┴──────────┐│       ┌─────▼──────┐  ┌▼────▼────▼─┐          ┌─────▼──▼───┐
│PCI Ecology│├───────►            │  │            │          │            │
│  Reviews  ├┘       │ bioRxiv v1 │  │ bioRxiv v2 │          │  eLife v1  │
└───────────┘        │            │  │            │          │            │
                     └─────┬──────┘  └─────┬──────┘          └─────┬──────┘
                           │               │                       │
                      ┌────┴──┐        ┌───┴───┐       ┌───────┬───┴────┬───────┐
                      │       │        │       │       │       │        │       │
                   ┌──▼──┐ ┌──▼──┐  ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌───▼──┐ ┌──▼──┐
                   │ Web │ │ PDF │  │ Web │ │ PDF │ │ Web │ │ PDF │ │ Lens │ │ ERA │
                   └─────┘ └─────┘  └─────┘ └─────┘ └─────┘ └─────┘ └──────┘ └─────┘
```

If a journal reviews submissions rather than the preprint, these are separate _expressions_:

```text
       ┌────────────────┐      ┌───────────────────────┐             ┌────────────────┐
       │   PCI Ecology  ├──────►                       ◄─────────────┤    PeerJ       ◄──┐
       │ Recommendation ├──┐   │        Article        │             │ Recommendation │  │
       └──▲─────────────┘  │   │                       │             └────────┬───────┘  │
          │                │   └───────────┬───────────┘                      │        ┌─┴───────┐
          │                └───────────┐   │                                  │       ┌┴────────┐│
          │                ┌───────────┼───┴────┬───────┬──────────────────┐  │       │  PeerJ  ││
          │                │           │        │       │     ┌────────────┼──┼───────┤ Reviews ├┘
 ┌────────┴──┐             │           │        │    ┌──▼─────▼────┐       │  │       └─────────┘
┌┴──────────┐│       ┌─────▼──────┐  ┌─▼────────▼─┐ ┌┴────────────┐│ ┌─────▼──▼───┐
│PCI Ecology│├───────►            │  │            │ │    PeerJ    ││ │            │
│  Reviews  ├┘       │ bioRxiv v1 │  │ bioRxiv v2 │ │ Submissions ├┘ │  PeerJ v1  │
└───────────┘        │            │  │            │ └──────┬──────┘  │            │
                     └─────┬──────┘  └─────┬──────┘        │         └─────┬──────┘
                           │               │            ┌──▼──┐            │
                      ┌────┴──┐        ┌───┴───┐        │ PDF │        ┌───┴───┐
                      │       │        │       │        └─────┘        │       │
                   ┌──▼──┐ ┌──▼──┐  ┌──▼──┐ ┌──▼──┐                 ┌──▼──┐ ┌──▼──┐
                   │ Web │ │ PDF │  │ Web │ │ PDF │                 │ Web │ │ PDF │
                   └─────┘ └─────┘  └─────┘ └─────┘                 └─────┘ └─────┘
```

This graph can continue to expand with links to and from authors, reviewers, related works etc.

## Open questions

- **Exactly which ontologies and properties should be used/recommended?**
  Concepts often overlap; [Schema.org] is well-known, but is insufficient on its own; the [Spar Ontologies] are great, but aren't particularly well known. [Reasoning] can help.

- **How should these resources be identified?**
  Ideally by the organisation responsible (so bioRxiv for their content, eLife for their content, PCI Ecology for their content), but the _work_ itself is only by the author(s).

- **How could this work with Doc Maps?**
  Can be used alongside, or maybe Doc Maps should actually be RDF?

[bioRxiv]: https://www.biorxiv.org/
[Blazegraph]: https://blazegraph.com/
[Docker Compose]: https://docs.docker.com/compose/
[Doc Maps]: https://docmaps.knowledgefutures.org/
[DocMaps Framework]: https://docmaps.knowledgefutures.org/pub/sgkf1pqa
[FaBiO]: http://www.sparontologies.net/ontologies/fabio
[FOAF]: http://xmlns.com/foaf/spec/
[FRBR]: https://en.wikipedia.org/wiki/Functional_Requirements_for_Bibliographic_Records
[FRBR Diagram]: http://www.dlib.org/dlib/september02/hickey/hickey-fig1.gif
[Graph Explorer]: https://github.com/zazuko/graph-explorer
[Hydra]: https://www.hydra-cg.com/
[JSON-LD]: https://en.wikipedia.org/wiki/JSON-LD
[Linked Data Notifications]: https://www.w3.org/TR/ldn/
[OBI]: http://obi-ontology.org/
[ORG]: http://www.w3.org/TR/vocab-org/
[PWO]: http://www.sparontologies.net/ontologies/pwo
[RDF]: https://en.wikipedia.org/wiki/Resource_Description_Framework
[RDF is a pain]: https://book.validatingrdf.com/bookHtml005.html
[RDF/XML]: https://en.wikipedia.org/wiki/RDF/XML
[Reasoning]: https://rubenverborgh.github.io/Semantic-Web-Reasoning/
[Schema.org]: https://schema.org/
[Sciety]: https://sciety.org/
[Spar Ontologies]: http://www.sparontologies.net/
[SPARQL]: https://en.wikipedia.org/wiki/SPARQL
[SPEX]: https://github.com/zazuko/SPEX
[Trifid]: https://zazuko.com/products/trifid/
[Turtle]: https://www.w3.org/TR/turtle/
[W3C]: https://en.wikipedia.org/wiki/World_Wide_Web_Consortium
[Yasgui]: https://triply.cc/docs/yasgui
