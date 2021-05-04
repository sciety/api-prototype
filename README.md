# Sciety API experimentation

## About

This repo contains an experiment into creating an RDF-based API for integration between [Sciety], [bioRxiv] and others.

It makes use of the [Spar Ontologies], especially [FRBR-aligned Bibliographic Ontology (FaBiO)](FaBiO).

## Getting started

> This requires [Docker Compose]

The [Turtle] files in [`data`](./data) contain RDF statements describing articles, their versions, and their evaluations.

If you run `docker-compose up` a [Trifid] server is available to view the resources (e.g. <http://localhost:8080/peerj.11014v0.1-decision>). This is read from a [Apache Jena Fuseki] instance available at <http://localhost:8081/> (username <kbd>admin</kbd>, password <kbd>password</kbd>).

There is also a basic client querying and display information about articles and their evaluations at <http://localhost:8082>.

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

[Apache Jena Fuseki]: https://jena.apache.org/documentation/fuseki2/
[bioRxiv]: https://www.biorxiv.org/
[Docker Compose]: https://docs.docker.com/compose/
[FaBiO]: http://www.sparontologies.net/ontologies/fabio
[FRBR]: https://en.wikipedia.org/wiki/Functional_Requirements_for_Bibliographic_Records
[FRBR Diagram]: https://upload.wikimedia.org/wikipedia/commons/8/80/FRBR-Group-1-entities-and-basic-relations.svg
[Sciety]: https://sciety.org/
[Spar Ontologies]: http://www.sparontologies.net/
[Trifid]: https://zazuko.com/products/trifid/
[Turtle]: https://www.w3.org/TR/turtle/
