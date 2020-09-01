import { Worker, types } from '../ain-connect-sdk';
import Logger from '../common/logger';
import * as dockerHandler from '../handler/dockerHandler';
import * as kubernetesHandler from '../handler/kubernetesHandler';

const log = Logger.createLogger('manager.workerManager');

export default class WorkerManager {
  private workerSdk: Worker

  private clusterName: string;

  private clusterInfo: types.ClusterRegisterParams;

  constructor(clusterName: string, mnemonic: string, env: 'staging' | 'prod') {
    this.workerSdk = new Worker(mnemonic, env);
    this.clusterName = clusterName;
  }

  public async start() {
    this.clusterInfo = await this.workerSdk.getClusterInfo(this.clusterName);
    log.info(`
      workerAddress: ${this.workerSdk.getAddress()}
      clusterName: ${this.clusterInfo.clusterName}
      endpointConfig: ${this.clusterInfo.endpointConfig}
      clusterTitle: ${this.clusterInfo.clusterTitle}
      clusterDescription: ${this.clusterInfo.clusterDescription}
      clusterType: ${(this.clusterInfo.isSingleNode) ? 'docker' : 'k8s'}
    `);
    this.workerSdk.listenClusterInfo(this.clusterName, (key: string, value: string) => {
      if (this.clusterInfo[key]) {
        this.clusterInfo[key] = value;
      }
    });
    this.requestListen();
  }

  private requestListen() {
    this.workerSdk.listenReqeust(this.clusterInfo.clusterName, {
      deploy: this.deploy,
      redeploy: this.redeploy,
      undeploy: this.undeploy,
      createStorage: this.createStorage,
      deleteStorage: this.deleteStorage,
      getContainerInfo: this.getContainerInfo,
      getClusterInfo: this.getClusterInfo,
      getClusterList: this.getClusterList,
    });
  }

  private deploy = async (params: types.DeployParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.deploy(params);
    } else {
      result = await kubernetesHandler.deploy(params);
    }
    return result;
  };

  private redeploy = async (params: types.RedeployParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.redeploy(params);
    } else {
      result = await kubernetesHandler.redeploy(params);
    }
    return result;
  };

  private undeploy = async (params: types.UndeployParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.undeploy(params);
    } else {
      result = await kubernetesHandler.undeploy(params);
    }
    return result;
  };

  private createStorage = async (params: types.CreateStorageParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.createStorage(params);
    } else {
      result = await kubernetesHandler.createStorage(params);
    }
    return result;
  };

  private deleteStorage = async (params: types.DeleteStorageParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.deleteStorage(params);
    } else {
      result = await kubernetesHandler.deleteStorage(params);
    }
    return result;
  };

  private getContainerInfo = async (params: types.GetContainerInfoParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.getContainerInfo(params);
    } else {
      result = await kubernetesHandler.getContainerInfo(params);
    }
    return result;
  };

  private getClusterInfo = async (params: types.GetClusterInfoParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.getClusterInfo(params);
    } else {
      result = await kubernetesHandler.getClusterInfo(params);
    }
    return result;
  };

  private getClusterList = async (params: types.GetClusterListParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.getClusterList(params);
    } else {
      result = await kubernetesHandler.getClusterList(params);
    }
    return result;
  };
}
