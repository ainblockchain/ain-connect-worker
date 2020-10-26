import K8sUtil from '../util/k8s';

export default class Worker {
  // K8s Handler
  protected k8sUtil: K8sUtil;

  constructor(configPath: string) {
    this.k8sUtil = new K8sUtil(configPath);
  }

  // SDK Handler
  public createNamespace = async (_: any) => {
    await this.k8sUtil.createNamespace(_);
  }

  public deleteNamespace = async (_: any) => ({ })

  public deploy = async (_: any) => ({ })

  public redeploy = async (_: any) => ({ })

  public undeploy = async (_: any) => ({ })

  public createStorage = async (_: any) => ({ })

  public deleteStorage = async (_: any) => ({ })

  public createSecret = async (_: any) => ({ })
}
