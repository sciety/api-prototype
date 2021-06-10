.PHONY: build test

PWD:=$(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

build:
	docker build --tag test-shacl .

test:
	docker run --rm -t --volume "$(PWD)/schema":/schema:ro --volume "$(PWD)/test":/test:ro test-shacl /test /schema
