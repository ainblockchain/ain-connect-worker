import * as k8s from '../handler/k8sHandler';

export default class Worker {
  // K8s Handler
  public apply = k8s.apply

  // API:Get Info
  public k8sGetPodInfo = k8s.getPodInfo

  public k8sGetNodesStatus = k8s.getNodesStatus;

  public k8sWatchNodes = k8s.watchNodes

  public k8sWatchPods = k8s.watchPods

  public k8sWatchStorage = k8s.watchStorage

  // API:Create
  public k8sCreateIstioGateway = k8s.createIstioGateway

  public k8sCreateNamespace = k8s.createNamespace

  public k8sCreateDeployment = k8s.createDeployment

  public k8sCreateService = k8s.createService

  public k8sCreateVirtualService = k8s.creteaVirtualService

  public k8sCreateStrorage = k8s.createStorage

  public k8sCreateDockerSecret = k8s.createDockerSecret

  public k8sCreateSecret = k8s.createSecret

  public k8sDeleteNamespace = k8s.deleteNamespace

  public k8sDeleteDeployment = k8s.deleteDeployment

  public k8sDeleteService = k8s.deleteService

  public k8sDeleteVirtualService = k8s.deleteVirtualService

  public k8sDeleteStorage = k8s.deleteStorage

  public k8sExistDeployment = k8s.existDeployment

  public k8sExistSecret = k8s.existSecret

  public k8sExistStorage = k8s.existStorage

  public k8sPatchDeployment = k8s.patchDeployment

  // @TODO Docker Handler

  // SDK Handler
  public createNamespace = async (_: any) => ({ })

  public deleteNamespace = async (_: any) => ({ })

  public deploy = async (_: any) => ({ })

  public redeploy = async (_: any) => ({ })

  public undeploy = async (_: any) => ({ })

  public createStorage = async (_: any) => ({ })

  public deleteStorage = async (_: any) => ({ })

  public createSecret = async (_: any) => ({ })
}
