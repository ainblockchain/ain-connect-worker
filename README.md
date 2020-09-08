**AIN Connect Worker** AIN Connect Worker is the intermediary between the Cluster and the "AIN Connect".


# How to deploy docker image
```
TAG={docker tag} NODE_ENV={staging | prod} ./dockerbuild.sh 
```

# Local
- for test

## prerequisites <Worker for K8s>
- Install k8s CLI(Kubectl)
- Set Cluster

## prerequisites <Worker For Docker>
- Install Docker [link](https://blog.cosmosfarm.com/archives/248/%EC%9A%B0%EB%B6%84%ED%88%AC-18-04-%EB%8F%84%EC%BB%A4-docker-%EC%84%A4%EC%B9%98-%EB%B0%A9%EB%B2%95/).

## How to start
```
// (1)
yarn
NODE_ENV={staging | prod} MNEMONIC={MNEMONIC} CLUSTER_NAME={CLUSTER_NAME} yarn start
```

# Docker

## How to start <Worker for K8s>
```
sudo docker run --name {NAME} -d  \
  -v {account.yaml Path}:/root/.kube/config
  -e NODE_ENV={staging | prod} -e MNEMONIC={MNEMONIC} -e CLUSTER_NAME={CLUSTER_NAME}
  ainblockchain/ainblockchain/ain-connect-cluster-{staging | prod}:{Tag}
```
- how to create account.yaml: "NAME={account_name} ./create_account.sh" after set kubectl.


## How to start <Worker for Docker>
```
sudo docker run --name {NAME} -d  \
  -v ${docker.sock path}:/var/run/docker.sock 
  -e NODE_ENV={staging | prod} -e MNEMONIC={MNEMONIC} -e CLUSTER_NAME={CLUSTER_NAME}
  ainblockchain/ainblockchain/ain-connect-cluster-{staging | prod}:{Tag}
```




