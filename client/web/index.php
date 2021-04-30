<?php

use EasyRdf\RdfNamespace;
use EasyRdf\Sparql\Client;

require_once __DIR__.'/../vendor/autoload.php';

RdfNamespace::set('cito', 'http://purl.org/spar/cito/');
RdfNamespace::set('fabio', 'http://purl.org/spar/fabio/');
RdfNamespace::set('frbr', 'http://purl.org/vocab/frbr/core#');
RdfNamespace::set('sciety', 'http://localhost:8080/');

$sparql = new Client("http://jena:3030/sciety");

$articles = $sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?work rdf:type fabio:ResearchPaper .
  ?work rdfs:label ?title .
}

ORDER BY ASC(?date)
SPARQL);

echo "<!doctype html><title>Articles</title><body><h1>Articles</h1>";

echo '<ul>';

foreach ($articles as $article) {
    echo "<li><a href=\"article.php?id={$article->work->localName()}\">{$article->title->getValue()}</a>";
}

echo '</ul>';
