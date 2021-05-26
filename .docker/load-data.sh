#!/usr/bin/env sh

sed "s|NAMESPACE|$NAMESPACE|" < load-data.ini | curl --fail-with-body --data-binary @- --header "Content-Type: text/plain" http://blazegraph:8080/bigdata/dataloader
