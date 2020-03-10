#!/bin/bash

if [ $NODE_ENV = "prod" ]; then
  local dockerUrl="ainblockchain/ain-connect-worker"
elif [ $NODE_ENV = "staging" ]; then
  local dockerUrl="ainblockchain/ain-connect-worker-staging"
fi

mv ./.env.$NODE_ENV ./.env
docker build -t ${dockerUrl}:${tag} .
docker push ${dockerUrl}:${tag}
mv ./.env ./.env.$NODE_ENV 

