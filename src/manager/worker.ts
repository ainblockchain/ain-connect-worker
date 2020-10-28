import K8sUtil from '../util/k8s';

export default class Worker {
  // K8s Handler
  protected k8sUtil: K8sUtil;

  constructor(configPath: string) {
    this.k8sUtil = new K8sUtil(configPath);
  }

  // SDK Handler
  protected createNamespace = async (_: any) => {
    await this.k8sUtil.createNamespace(_);
    return { namespaceId: _ };
  }

  protected deleteNamespace = async (_: any) => ({ })

  protected deploy = async (_: any) => ({ })

  protected redeploy = async (_: any) => ({ })

  protected undeploy = async (_: any) => ({ })

  protected createStorage = async (_: any) => ({ })

  protected deleteStorage = async (_: any) => ({ })

  protected createSecret = async (_: any) => ({ })
}
