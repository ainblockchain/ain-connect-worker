import * as k8s from '../handler/k8sHandler';

export default class Worker {
  // K8s Handler
  public apply = k8s.apply

  // API:Get Info
  public k8sGetPodInfo = k8s.getPodInfo

  public k8sWatchNodes = k8s.watchNodes

  public k8sWatchPods = k8s.watchPods

  public k8sWatchStorage = k8s.watchStorage

  // API:Create
  public k8sCreateNamespace = k8s.createNamespace

  public k8sCreateDeployment = k8s.createDeployment

  public k8sCreateService = k8s.createService

  public k8sCreateVirtualService = k8s.creteaVirtualService

  public k8sCreateStrorage = k8s.createStorage

  public createDockerSecret = k8s.createDockerSecret

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
