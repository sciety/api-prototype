<?php

use EasyRdf\RdfNamespace;
use EasyRdf\Sparql\Client;

require_once __DIR__.'/../vendor/autoload.php';

RdfNamespace::set('cito', 'http://purl.org/spar/cito/');
RdfNamespace::set('fabio', 'http://purl.org/spar/fabio/');
RdfNamespace::set('frbr', 'http://purl.org/vocab/frbr/core#');
RdfNamespace::set('sciety', $_ENV['NAMESPACE']);

$sparql = new Client($_ENV['SPARQL_URL']);

$articles = $sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?work rdf:type fabio:ResearchPaper .
  ?work rdfs:label ?title .
}

ORDER BY ASC(?date)
SPARQL);

echo "<!doctype html><title>Articles</title>";
echo "<meta name=\"viewport\" content=\"width=device-width\">";
echo "<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/water.css@2/out/water.css\">";
echo "<body><h1>Articles</h1>";

echo '<ul>';

foreach ($articles as $article) {
    echo "<li><a href=\"article.php?id={$article->work->localName()}\">{$article->title->getValue()}</a>";
}

echo '</ul>';
