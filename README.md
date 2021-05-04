# Sciety API experimentation

## About

This repo contains an experiment into creating an RDF-based API for integration between [Sciety], [bioRxiv] and others.

Makes use of the [Spar Ontologies], especially [FRBR-aligned Bibliographic Ontology (FaBiO)](FaBiO).

## Getting started

> This requires [Docker Compose]

The [Turtle] files in [`data`](./data) contain RDF statements describing articles, their versions, and their evaluations.

If you run `docker-compose up` a [Trifid] server is available to view the resources (e.g. <http://localhost:8080/peerj.11014v0.1-decision>). This is read from a [Apache Jena Fuseki] instance available at <http://localhost:8081/> (username <kbd>admin</kbd>, password <kbd>password</kbd>).

There is also a basic client querying and display information about articles and their evaluations at <http://localhost:8082>.

## Modelling

Makes use of the first 3 levels of [Functional Requirements for Bibliographic Records (FRBR)](FRBR):

![][FRBR Diagram]

A paper (_work_) can be published in multiple places (_expressions_), where it can have multiple formats (_manifestation_). Individual copies of these (_item_) don't need to be modelled here.

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

An evaluation, be it a review, recommendation or something else, links to the appropriate class.

A review by The 2019 Novel Coronavirus Research Compendium (NCRC), for example, would apply to a single _expression_. That is, it covers its various formats, but not other versions of the article.

A recommendation by Peer Community in Ecology, however, could apply to the _work_ itself. This recommendation still applies to future publication in a journal.

[Apache Jena Fuseki]: https://jena.apache.org/documentation/fuseki2/
[bioRxiv]: https://www.biorxiv.org/
[Docker Compose]: https://docs.docker.com/compose/
[FaBiO]: http://www.sparontologies.net/ontologies/fabio
[FRBR]: https://en.wikipedia.org/wiki/Functional_Requirements_for_Bibliographic_Records
[FRBR]: https://upload.wikimedia.org/wikipedia/commons/8/80/FRBR-Group-1-entities-and-basic-relations.svg
[Sciety]: https://sciety.org/
[Spar Ontologies]: http://www.sparontologies.net/
[Trifid]: https://zazuko.com/products/trifid/
[Turtle]: https://www.w3.org/TR/turtle/
