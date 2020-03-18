#!/bin/bash

if [ $NODE_ENV = "prod" ]; then
  dockerUrl="ainblockchain/ain-connect-cluster"
elif [ $NODE_ENV = "staging" ]; then
  dockerUrl="ainblockchain/ain-connect-cluster-staging"
fi

docker build -t ${dockerUrl}:$TAG .
docker push ${dockerUrl}:$TAG

