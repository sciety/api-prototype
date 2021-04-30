<?php

use EasyRdf\RdfNamespace;
use EasyRdf\Sparql\Client;

require_once __DIR__.'/../vendor/autoload.php';

$articleId = 'sciety:pigs-article';

RdfNamespace::set('frbr', 'http://purl.org/vocab/frbr/core#');
RdfNamespace::set('sciety', 'http://localhost:8080/');

$sparql = new Client("http://jena:3030/sciety");

$article = $sparql->query(<<<SPARQL
DESCRIBE {$articleId}
SPARQL)->resource($articleId);

echo "<!doctype html><title>{$article->label()}</title><body><h1>{$article->label()}</h1>";
