# How to start
1. yarn
2. NODE_ENV={staging | prod} \
   CLUSTER_NAME={Cluster Name} \
   DESCRIPTION={Cluster description} \
   MNEMONIC={Cluster mnemonic} \ 
   CPU={container cpu limit (ex. 50m)} \
   GPU={container gpu limit - int (ex. 1)} \
   STORAGE={container storage limit (ex. 1gb)} \
   IMAGE={container docker image (ex. ainblockchain/ain-connect-container)} \
   yarn start