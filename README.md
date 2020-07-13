

**AIN Connect Cluster Master** The Cluster Master is the intermediary between the Cluster and the "AIN Connect".


# How to start

## Local
```
// 1. add .env.{staging | prod}
// 2
yarn
// 3
NODE_ENV={staging | prod} yarn start
```

## Docker
```
// 1. add .env.{staging | prod}
// 2
sudo docker run --name {NAME} -d  \
  -v {Env Path}:/server/.env \
  -v {account.yaml Path}:/root/.kube/config
  ainblockchain/ainblockchain/ain-connect-cluster-{staging | prod}:{Tag}
```
- how to install docker (https://blog.cosmosfarm.com/archives/248/%EC%9A%B0%EB%B6%84%ED%88%AC-18-04-%EB%8F%84%EC%BB%A4-docker-%EC%84%A4%EC%B9%98-%EB%B0%A9%EB%B2%95/)


# How to deploy docker image
```
TAG={docker tag} NODE_ENV={staging | prod} ./dockerbuild.sh 
```
