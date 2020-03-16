# How to start
1. yarn
2. 
```
NODE_ENV={staging | prod} \
CLUSTER_NAME={Cluster Name} \
DESCRIPTION={Cluster description} \
MNEMONIC={Cluster mnemonic} \ 
CPU_LIMIT={container cpu limit (ex. 50m)} \
GPU_LIMIT={container gpu limit - int (ex. 1)} \
STORAGE_LIMIT={container storage limit (ex. 1Gi)} \
MEMORY_LIMIT={container memory limit (ex. 100Mi)} \
IMAGE={container docker image (ex. ainblockchain/ain-connect-container)} \
yarn start
```
