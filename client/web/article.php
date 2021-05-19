<?php

use EasyRdf\RdfNamespace;
use EasyRdf\Sparql\Client;

require_once __DIR__.'/../vendor/autoload.php';

$articleId = $_GET['id'] ? preg_replace('/[^A-z0-9-]/', '', $_GET['id']) : null;

if(!$articleId) {
  http_response_code(404);
  return;
}

RdfNamespace::set('cito', 'http://purl.org/spar/cito/');
RdfNamespace::set('fabio', 'http://purl.org/spar/fabio/');
RdfNamespace::set('frbr', 'http://purl.org/vocab/frbr/core#');
RdfNamespace::set('sciety', 'http://localhost:8080/');

$sparql = new Client("http://jena:3030/sciety");

$article = $sparql->query(<<<SPARQL
DESCRIBE sciety:{$articleId}
SPARQL)->resource("sciety:{$articleId}");

if(!$article->label()) {
  http_response_code(404);
  return;
}

$recommendations = iterator_to_array($sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?item cito:citesAsRecommendedReading {$article->shorten()} .
  ?expression frbr:realizationOf ?item .
  ?expression dcterms:publisher ?publisher .
  ?publisher rdfs:label ?publisherLabel .
}

ORDER BY ASC(?publisherLabel)
SPARQL));

$versions = $sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?item frbr:realizationOf {$article->shorten()} .
  ?item dcterms:date ?date .
  OPTIONAL {
    ?item frbr:partOf ?journal .
    ?journal rdf:type fabio:Journal .
    ?journal dcterms:title ?journalName .
  }
  ?item dcterms:publisher ?publisher .
  OPTIONAL {
    ?item dcterms:title ?title .
  }
  OPTIONAL {
    ?item dcterms:identifier ?doi .
    FILTER(strStarts(?doi, 'doi:')) .
  }
  ?publisher rdfs:label ?publisherLabel .
  OPTIONAL {
    ?item fabio:hasManifestation ?webPage .
    ?webPage rdf:type fabio:WebPage .
    ?webPage fabio:hasURL ?webPageUrl .
  }
  OPTIONAL {
    ?item fabio:hasManifestation ?pdf .
    ?pdf dcterms:format 'application/pdf' .
    ?pdf fabio:hasURL ?pdfUrl .
  }
}

ORDER BY ASC(?date)
SPARQL);

$reviews = $sparql->query(<<<SPARQL
SELECT *

WHERE {
  ?version frbr:realizationOf {$article->shorten()} .
  ?item cito:reviews ?version .
  ?expression frbr:realizationOf ?item .
  ?expression dcterms:title ?title .
  ?expression dcterms:date ?date .
  ?expression dcterms:publisher ?publisher .
  ?publisher rdfs:label ?publisherLabel .
  OPTIONAL {
    ?expression dcterms:identifier ?doi .
    FILTER(strStarts(?doi, 'doi:')) .
  }
  OPTIONAL {
    ?scietyManifestation frbr:embodimentOf ?expression .
    ?scietyManifestation dcterms:publisher sciety:sciety .
    ?scietyManifestation fabio:hasURL ?scietyUrl .
  }
}

ORDER BY ASC(?date)
SPARQL);

echo "<!doctype html><title>{$article->label()}</title>";
echo "<meta name=\"viewport\" content=\"width=device-width\">";
echo "<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/water.css@2/out/water.css\">";
echo "<body style=\"max-width: 1200px\"><h1>{$article->label()}</h1>";
echo "<p>IRI: <a href=\"{$article->getUri()}\">{$article->getUri()}</a>";
if(count($recommendations)) {
    echo '<p><strong>Recommended by: ';
    echo implode(', ', array_map(fn($recommendation) => $recommendation->publisherLabel->getValue(), $recommendations));
    echo '</strong>';
}

echo '<hr>';
echo '<h2>Article history</h2>';
echo '<div style="overflow-x: auto">';
echo '<table style="min-width: 100%; width: auto"><thead><tr><th>Version<th>Date<th>Published by<th>DOI<th>IRI</tr></thead><tbody>';

foreach ($versions as $version) {
    $title = isset($version->title) ? $version->title->getValue() : '(no title)';
    $doi = isset($version->doi) ? substr($version->doi->getValue(), 4) : null;
    $publisher = $version->publisherLabel->getValue();
    if(isset($version->journalName)) {
        $publisher = "{$version->journalName->getValue()} ($publisher)";
    }

    if (isset($version->webPageUrl)) {
        $url = $version->webPageUrl->getValue();
    } elseif (isset($version->pdfUrl)) {
        $url = $version->pdfUrl->getValue();
    } else {
        $url = null;
    }

    if ($url) {
        $title = "<a href=\"{$url}\">{$title}</a>";
    }
    echo <<<HTML
<tr>
<th>{$title}
<td>{$version->date->format('j F Y')}
<td>{$publisher}
<td>{$doi}
<td><a href="{$version->item}">{$version->item}</a>
HTML;
}

echo '</table></div>';

echo '<hr>';
echo '<h2>Reviews</h2>';
echo '<div style="overflow-x: auto">';
echo '<table style="min-width: 100%; width: auto"><thead><tr><th>Review<th>Review of<th>Date<th>Reviewed by<th>DOI<th>IRI</tr></thead><tbody>';

foreach ($reviews as $review) {
    $doi = isset($review->doi) ? substr($review->doi->getValue(), 4) : null;
    $title = $review->title->getValue();
    if (isset($review->scietyUrl)) {
        $title = "<a href=\"{$review->scietyUrl}\">$title</a>";
    }
    echo <<<HTML
<tr>
<th>{$title}
<td><a href="$review->version">{$review->version}</a>
<td>{$review->date->format('j F Y')}
<td>{$review->publisherLabel->getValue()}
<td>{$doi}
<td><a href="{$review->expression}">{$review->expression}</a>
HTML;
}

echo '</table></div>';
