**AIN Connect Worker Base** AIN Connect Worker is the intermediary between the Cluster and the "AIN Connect".


# Install
```
npm install @aindev/connect-worker-base
```

# How to Use
```
import Worker from '@aindev/connect-worker-base';
class customWorker extends Worker {
   deploy(params) {
     ...
   }
   createStorage(params) {
     ...
   }
   deleteStorage(params) {
     ...
   }
}
```