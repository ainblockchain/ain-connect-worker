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
      createResource: this.createResource,
      deleteResource: this.deleteResource,
      getResourceStatus: this.getResourceStatus,
      setResourceConfig: this.setResourceConfig,
    });
  }

  private createResource = async (params: types.CreateResourceParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.createResource(params);
    } else {
      result = await kubernetesHandler.createResource(params);
    }
    return result;
  };

  private deleteResource = async (params: types.DeleteResourceParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.deleteResource(params);
    } else {
      result = await kubernetesHandler.deleteResource(params);
    }
    return result;
  };

  private getResourceStatus = async (params: types.GetResourceStatusParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.getResourceStatus(params);
    } else {
      result = await kubernetesHandler.getResourceStatus(params);
    }
    return result;
  }

  private setResourceConfig = async (params: types.SetResourceConfigParams) => {
    let result;
    if (this.clusterInfo.isSingleNode) {
      result = await dockerHandler.setResourceConfig(params);
    } else {
      result = await kubernetesHandler.setResourceConfig(params);
    }
    return result;
  }
}
