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

  public k8sDeleteNamespace = k8s.deleteNamespace

  public k8sDeleteDeployment = k8s.deleteDeployment

  public k8sDeleteService = k8s.deleteService

  public k8sDeleteVirtualService = k8s.deleteVirtualService

  public k8sDeleteStorage = k8s.deleteStorage

  // @TODO Docker Handler

  // SDK Handler
  public createNamespace = async (_: any) => ({ statusCode: 0 })

  public deleteNamespace = async (_: any) => ({ statusCode: 0 })

  public deploy = async (_: any) => ({ statusCode: 0 })

  public redeploy = async (_: any) => ({ statusCode: 0 })

  public undeploy = async (_: any) => ({ statusCode: 0 })

  public createStorage = async (_: any) => ({ statusCode: 0 })

  public deleteStorage = async (_: any) => ({ statusCode: 0 })

  public getContainerInfo = async (_: any) => ({ statusCode: 0 })
}
