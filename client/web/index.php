<?php

use EasyRdf\RdfNamespace;
use EasyRdf\Sparql\Client;

require_once __DIR__.'/../vendor/autoload.php';

$articleId = 'sciety:pigs-article';

RdfNamespace::set('fabio', 'http://purl.org/spar/fabio/');
RdfNamespace::set('frbr', 'http://purl.org/vocab/frbr/core#');
RdfNamespace::set('sciety', 'http://localhost:8080/');

$sparql = new Client("http://jena:3030/sciety");

$article = $sparql->query(<<<SPARQL
DESCRIBE {$articleId}
SPARQL)->resource($articleId);

$versions = $sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?item frbr:realizationOf {$articleId} .
  ?item dcterms:date ?date .
  ?item dcterms:publisher ?publisher .
  OPTIONAL {
    ?item dcterms:title ?title .
  }
  OPTIONAL {
    ?item dcterms:identifier ?doi .
    FILTER(strStarts(?doi, 'doi:')) .
  }
  ?publisher rdfs:label ?publisherLabel .
  ?item fabio:hasManifestation ?manifestation .
  ?manifestation fabio:hasURL ?manifestationUrl .
}

ORDER BY ASC(?date)
SPARQL);

echo "<!doctype html><title>{$article->label()}</title><body><h1>{$article->label()}</h1>";

echo '<table><thead><tr><th>Version<th>Date<th>Published by<th>DOI</tr></thead><tbody>';

foreach ($versions as $version) {
    $title = isset($version->title) ? $version->title->getValue() : '(no title)';
    $doi = isset($version->doi) ? substr($version->doi->getValue(), 4) : null;
    $url = $doi ? "https://doi.org/${doi}" : $version->manifestationUrl->getValue();
    echo <<<HTML
<tr>
<th><a href="{$url}">{$title}</a>
<td>{$version->date->format('j F Y')}
<td>{$version->publisherLabel->getValue()}
<td>{$doi}
HTML;
}

echo '</table>';
