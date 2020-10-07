import * as k8s from '../handler/k8sHandler';

export default class Worker {
  // K8s Handler
  public apply = k8s.apply

  public getPodInfo = k8s.getPodInfo

  public getNamespaceJson = k8s.getNamespaceJson

  public getDeploymentJson = k8s.getDeploymentJson

  public getServiceJson = k8s.getServiceJson

  public getVirtualServiceJson = k8s.getVirtualServiceJson

  public getStorageJson = k8s.getStorageJson

  // @TODO Docker Handler

  // SDK Handler
  public createNamespace = () => ({ statusCode: 0 })

  public deleteNamespace = () => ({ statusCode: 0 })

  public deploy = () => ({ statusCode: 0 })

  public redeploy = () => ({ statusCode: 0 })

  public undeploy = () => ({ statusCode: 0 })

  public createStorage = () => ({ statusCode: 0 })

  public deleteStorage = () => ({ statusCode: 0 })

  public getContainerInfo = () => ({ statusCode: 0 })
}
