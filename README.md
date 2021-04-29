# api-prototype
Experimental work relating to a prototype of a Sciety API

[`frbr.ttl`](./frbr.ttl) contains RDF statements describing an article and its versions, and its evaluations.

If you run `docker-compose up` a [Trifid](https://zazuko.com/products/trifid/) server is available to view the resources (e.g. <http://localhost:8080/peerj.11014v0.1-decision>). This is read from a [Apache Jena Fuseki](https://jena.apache.org/documentation/fuseki2/) instance available at http://localhost:8081/.
