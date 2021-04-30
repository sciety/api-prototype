<?php

use EasyRdf\RdfNamespace;
use EasyRdf\Sparql\Client;

require_once __DIR__.'/../vendor/autoload.php';

$articleId = 'sciety:pigs-article';

RdfNamespace::set('cito', 'http://purl.org/spar/cito/');
RdfNamespace::set('fabio', 'http://purl.org/spar/fabio/');
RdfNamespace::set('frbr', 'http://purl.org/vocab/frbr/core#');
RdfNamespace::set('sciety', 'http://localhost:8080/');

$sparql = new Client("http://jena:3030/sciety");

$article = $sparql->query(<<<SPARQL
DESCRIBE {$articleId}
SPARQL)->resource($articleId);

$recommendations = iterator_to_array($sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?item cito:citesAsRecommendedReading {$articleId} .
  ?expression frbr:realizationOf ?item .
  ?expression dcterms:publisher ?publisher .
  ?publisher rdfs:label ?publisherLabel .
}

ORDER BY ASC(?publisherLabel)
SPARQL));

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

$reviews = $sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?version frbr:realizationOf {$articleId} .
  ?item cito:reviews ?version .
  ?expression frbr:realizationOf ?item .
  ?expression rdfs:label ?label .
  ?expression dcterms:date ?date .
  ?expression dcterms:publisher ?publisher .
  ?publisher rdfs:label ?publisherLabel .
  ?version rdfs:label ?versionLabel .
  OPTIONAL {
    ?scietyManifestation frbr:embodimentOf ?expression .
    ?scietyManifestation dcterms:publisher sciety:sciety .
    ?scietyManifestation fabio:hasURL ?scietyUrl .
  }
}

ORDER BY ASC(?date)
SPARQL);

echo "<!doctype html><title>{$article->label()}</title><body><h1>{$article->label()}</h1>";

if(count($recommendations)) {
    echo '<p><strong>Recommended by: ';
    echo implode(', ', array_map(fn($recommendation) => $recommendation->publisherLabel->getValue(), $recommendations));
    echo '</strong>';
}

echo '<hr>';
echo '<h2>Article history</h2>';
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

echo '<hr>';
echo '<h2>Reviews</h2>';
echo '<table><thead><tr><th>Review<th>Review of<th>Date<th>Reviewed by</tr></thead><tbody>';

foreach ($reviews as $review) {
    $url = $review->scietyUrl ?? null;
    $label = $url ? "<a href=\"{$url}\">{$review->label->getValue()}</a>" : $review->label->getValue();
    echo <<<HTML
<tr>
<th>{$label}
<td>{$review->versionLabel->getValue()}
<td>{$review->date->format('j F Y')}
<td>{$review->publisherLabel->getValue()}
HTML;
}

echo '</table>';
