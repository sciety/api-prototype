#!/usr/bin/env bash

mkdir -p /tmp/blazegraph/data

cp -r /data /tmp/blazegraph/data

curl -X POST -H "Content-Type: text/plain" \
  -d 'namespace=kb
propertyFile=/RWStore.properties
fileOrDirs=/tmp/blazegraph/data
-format=turtle
quiet=false
verbose=0
closure=false
durableQueues=false
' \
  http://localhost:8080/bigdata/dataloader

rm -rf /tmp/blazegraph/data
