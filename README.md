# How to start

```
// 1
yarn

// 2
NODE_ENV={staging | prod} \
CLUSTER_NAME={Cluster Name} \
DESCRIPTION={Cluster description} \
MNEMONIC={Cluster mnemonic} \ 
CPU_LIMIT_m={container cpu limit (ex. 50m)} \
GPU_LIMIT={container gpu limit - int (ex. 1)} \
STORAGE_LIMIT_Gi={container storage limit (ex. 1Gi)} \
MEMORY_LIMIT_Mi={container memory limit (ex. 100Mi)} \
IMAGE={container docker image (ex. ainblockchain/ain-connect-container)} \
yarn start
```

# how to create account for kubectl
```
NAME={account_name} ./create_account.sh
```

# how to deploy docker image
```
TAG={docker tag} NODE_ENV={staging | prod} ./dockerbuild.sh 
```
