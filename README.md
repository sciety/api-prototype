# api-prototype
Experimental work relating to a prototype of a Sciety API

The [Turtle](https://www.w3.org/TR/turtle/) files in [`data`](./data) contain RDF statements describing articles, their versions, and their evaluations.

If you run `docker-compose up` a [Trifid](https://zazuko.com/products/trifid/) server is available to view the resources (e.g. <http://localhost:8080/peerj.11014v0.1-decision>). This is read from a [Apache Jena Fuseki](https://jena.apache.org/documentation/fuseki2/) instance available at http://localhost:8081/.
