import * as k8s from '@kubernetes/client-node';
import * as request from 'request';
import { Base64 } from 'js-base64';
import * as types from '../common/type';

export default class K8sUtil {
  private config: k8s.KubeConfig;

  private coreApi: k8s.CoreV1Api;

  private appV1Api: k8s.AppsV1Api;

  private objectApi : k8s.KubernetesObjectApi;

  private serverAddr: string;

  constructor(configPath: string, test: boolean = false) {
    this.config = new k8s.KubeConfig();
    if (!test) {
      this.config.loadFromFile(configPath);
      // params for k8s API
      this.coreApi = this.config.makeApiClient(k8s.CoreV1Api);
      this.appV1Api = this.config.makeApiClient(k8s.AppsV1Api);
      this.objectApi = k8s.KubernetesObjectApi.makeApiClient(this.config);
      this.serverAddr = this.config.getCurrentCluster()!.server;
    }
  }

  /**
   * Get K8s Config.
  */
  getConfig() {
    return this.config;
  }

  /**
   * Get K8s CoreApi.
  */
  getCoreApi() {
    return this.coreApi;
  }

  /**
   * Get K8s AppV1Api.
  */
  getAppV1Api() {
    return this.appV1Api;
  }

  /**
   * Get K8s ObjectApi.
  */
  getObjectApi() {
    return this.objectApi;
  }

  /**
   * Get K8s Server Address.
  */
  getServerAddr() {
    return this.serverAddr;
  }

  /**
   * hwspec to cpu "m".
   * @params k8sUnit: k8s CPU resource Spec (ex. 1000m).
  */
  convertUnitCpu(k8sUnit: string) {
    if (k8sUnit.includes('m')) return parseInt(k8sUnit, 10);
    return parseInt(k8sUnit, 10) * 1000;
  }

  /**
   * hwspec to Memory "Mi".
   * @params k8sUnit: k8s MEMORY resource Spec (ex. 10Gi).
  */
  convertUnitMemory(k8sUnit: string) {
    if (k8sUnit.includes('Ki') || k8sUnit.includes('K')) return Math.round(parseInt(k8sUnit, 10) / 1000);
    if (k8sUnit.includes('Gi') || k8sUnit.includes('G')) return parseInt(k8sUnit, 10) * 1000;
    return parseInt(k8sUnit, 10);
  }

  /**
   * hwspec to Number (cpu: "m", memory: "Mi").
   * @params k8sHwspec: k8s CPU,MEMORY,GPU resource Spec.
  */
  convertHwSpecNumber(k8sHwspec: types.k8sHwSpec) {
    return {
      cpu: this.convertUnitCpu(k8sHwspec.cpu),
      memory: this.convertUnitMemory(k8sHwspec.memory),
      gpu: Number(k8sHwspec['nvidia.com/gpu']) || 0,
    };
  }

  /**
   * hwspec to k8s unit String.
   * @params HwSpec: custom CPU,MEMORY,GPU resource Spec.
  */
  convertHwSpecString(HwSpec: types.HwSpec) {
    return {
      cpu: `${HwSpec.cpu}m`,
      memory: `${HwSpec.memory}Mi`,
      'nvidia.com/gpu': String(HwSpec.gpu),
    };
  }

  /**
   * Apply yaml in JSON.
   * @params kubeJson: k8s yaml in JSON.
  */
  async apply(kubeJson: k8s.KubernetesObject) {
    kubeJson.metadata = kubeJson.metadata || {};
    kubeJson.metadata.annotations = kubeJson.metadata.annotations || {};
    kubeJson.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(kubeJson);

    try {
      // If it already exists, modify.
      await this.objectApi.read(kubeJson);
      const response = await this.objectApi.patch(kubeJson);
      return response.body;
    } catch (e) {
      try {
        const response = await this.objectApi.create(kubeJson);
        return response.body;
      } catch (error) {
        throw error.body;
      }
    }
  }

  // API:CREATE

  /**
   * Create Gateway for "istio".
   * @params name: gateway Name.
   * @params endpoint: wildcard Domain Name for gateway.
  */
  async createIstioGateway(name: string, endpoint: string) {
    const templateJson = {
      apiVersion: 'networking.istio.io/v1alpha3',
      kind: 'Gateway',
      metadata: {
        name,
        namespace: 'istio-system',
        labels: {
          templateVersion: 'v2-2',
          ainConnect: 'yes',
        },
      },
      spec: {
        selector: {
          istio: 'ingressgateway',
        },
        servers: [
          {
            port: {
              number: 80,
              name: 'http',
              protocol: 'HTTP',
            },
            hosts: [
              endpoint,
            ],
          },
        ],
      },
    };
    const result = await this.apply(templateJson);
    return result;
  }

  /**
   * Create Namespace.
   * @params name: Namespace Name.
  */
  async createNamespace(name: string) {
    const templateJson = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
        labels: {
          ainConnect: 'yes',
        },
      },
    };
    const result = await this.apply(templateJson);
    return result;
  }

  /**
   * Create Deployment.
   * @params name: Deployment Name.
   * @params namespace: Deployment Namespace Name.
   * @params containerSpec: Container Spec (ex. imagePath...).
   * @params storageSpecs: Storage Spec for mounting to Container.
   * @params secretSpec: Secret Spec for mounting to Container.
   * @params imagePullSecretName: params for pulling private Docker Images.
   * @params labels: params for labaling to "Pod" and Deployment
   * @params nodePoolLabel: params for select nodePool.
   *          [if it is undefined then select from all nodepool]
   * @params replicas: Number of Pods.
   * @params privileged: root.
  */
  async createDeployment(name: string, namespace: string,
    containerSpec: types.ContainerSpec, storageSpecs?: types.StorageSpecs,
    secretSpec?: types.SecretSpecs, imagePullSecretName?: string,
    labels?: {[key: string]: string}, nodePoolLabel?: Object, replicas?: number,
    privileged: boolean = false) {
    const templateJson = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        namespace,
        labels: {
          ...labels, app: name, templateVersion: '1', ainConnect: 'yes',
        },
        name,
      },
      spec: {
        replicas: replicas || 1,
        selector: { matchLabels: { ...labels, app: name, ainConnect: 'yes' } },
        template: {
          metadata: { labels: { ...labels, app: name, ainConnect: 'yes' } },
          spec: {
            nodeSelector: nodePoolLabel || {},
            containers: [
              {
                image: containerSpec.imagePath,
                imagePullPolicy: 'Always',
                name,
                ports: [] as Object[],
                volumeMounts: [] as Object[],
                env: [] as Object[],
                securityContext: {
                  privileged,
                },
                resources: {
                  requests: this.convertHwSpecString(containerSpec.resourceLimits),
                  limits: this.convertHwSpecString(containerSpec.resourceLimits),
                },
              },
            ],
            imagePullSecrets: [] as Object[],
            volumes: [] as Object[],
          },
        },
      },
    };

    if (containerSpec.env) {
      for (const key of Object.keys(containerSpec.env)) {
        templateJson.spec.template.spec.containers[0].env.push({
          name: key,
          value: String(containerSpec.env[key]),
        });
      }
    }

    if (containerSpec.ports) {
      for (const port of containerSpec.ports) {
        templateJson.spec.template.spec.containers[0].ports.push({
          containerPort: port,
        });
      }
    }

    if (imagePullSecretName) {
      templateJson.spec.template.spec.imagePullSecrets.push({
        name: imagePullSecretName,
      });
    }

    if (storageSpecs) {
      for (const storageId of Object.keys(storageSpecs)) {
        // Mount PVC
        templateJson.spec.template.spec.volumes.push({
          name: `${storageId}-ps`,
          persistentVolumeClaim: { claimName: `pv-${storageId}-claim` },
        });
        templateJson.spec.template.spec.containers[0].volumeMounts.push(JSON.parse(JSON.stringify({
          name: `${storageId}-ps`,
          mountPath: storageSpecs[storageId].mountPath,
        })));
      }
    }

    if (secretSpec) {
      for (const secretId of Object.keys(secretSpec)) {
        templateJson.spec.template.spec.volumes.push({
          name: secretId,
          secret: {
            secretName: secretId,
          },
        });
        templateJson.spec.template.spec.containers[0].volumeMounts.push(JSON.parse(JSON.stringify({
          name: secretId,
          mountPath: secretSpec[secretId].mountPath,
          defaultMode: '256',
        })));
      }
    }

    const result = await this.apply(templateJson);
    return result;
  }

  /**
   * Create Service.
   * @params name: Service Name (name -> {name}-lb).
   * @params namespace: Namespace Name.
   * @params ports: Port List that is internal Port and exteral Port.
   * @params labels: labels.
  */
  async createService(
    name: string, namespace: string,
    ports: number[], labels?: {[key: string]: string },
  ) {
    const templateJson = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        namespace,
        labels: {
          ...labels, app: name, templateVersion: '3', ainConnect: 'yes',
        },
        name: `${name}-lb`,
      },
      spec: {
        ports: [] as Object[],
        selector: { app: name },
      },
    };

    for (const port of ports) {
      templateJson.spec.ports.push({ name: `http${port}`, port, targetPort: port });
    }

    const result = await this.apply(templateJson);
    return result;
  }

  /**
   * Create VirtualService.
   * @params name: VirtualService Name (name -> {name}-vsvc${port}).
   * @params namespace: Namespace Name.
   * @params endpoint: full Domain Name for Pod.
   * @params gateway: istio gateway Name.
   * @params port: It is Service extenal Port.
   * @params labels: labels.
  */
  async createVirtualService(
    name: string, namespace: string,
    endpoint: string, gateway: string, port: number, labels?: {[key: string]: string },
  ) {
    const templateJson = {
      apiVersion: 'networking.istio.io/v1alpha3',
      kind: 'VirtualService',
      metadata: {
        name: `${name}-vsvc${port}`,
        namespace,
        labels: {
          ...labels, app: name, templateVersion: '3', ainConnect: 'yes',
        },
      },
      spec: {
        hosts: [endpoint],
        gateways: [gateway],
        http: [
          {
            route: [
              {
                destination: { host: `${name}-lb`, port: { number: port } },
              },
            ],
            headers: {
              request: {
                add: { 'x-forwarded-proto': 'https', 'x-forwarded-port': '443' },
              },
            },
            corsPolicy: {
              allowHeaders: ['x-access-token'],
              allowOrigin: ['*'],
              allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            },
          },
        ],
      },
    };

    const result = await this.apply(templateJson);
    return result;
  }

  /**
   * Create PersistentVolume.
   * @params name: Storage Name.
   * @params namespace: Namespace Name.
   * @params storageGb: storageGb.
   * @params storageClassName: k8s storageClass Name.
   * @params accessModes: ReadWriteMany or ReadWriteOnce.
   * @params nfsInfo: NFS Server Base Path +  NFS Server Address.
   * @params labels: labels.
  */
  async createPersistentVolume(
    name: string, namespace: string, storageGb: number, storageClassName: string,
    accessModes: 'ReadWriteMany' | 'ReadWriteOnce',
    nfsInfo?: types.NfsInfo, labels?: {[key: string]: string },
  ) {
    const pvTemplateJson = JSON.parse(JSON.stringify({
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: {
        namespace,
        name: `pv-${name}`,
        labels: { ...labels, app: name, ainConnect: 'yes' },
      },
      spec: {
        capacity: { storage: `${storageGb}Gi` },
        accessModes: [accessModes],
        storageClassName,
        nfs: (nfsInfo) ? { ...nfsInfo } : undefined,
      },
    }));

    const result = await this.apply(pvTemplateJson);

    return result;
  }

  /**
   * Create PersistentVolumeClaim.
   * @params name: Storage Name.
   * @params namespace: Namespace Name.
   * @params storageGb: storageGb.
   * @params storageClassName: k8s storageClass Name.
   * @params accessModes: ReadWriteMany or ReadWriteOnce.
   * @params nfsInfo: NFS Server Base Path +  NFS Server Address.
   * @params labels: labels.
  */
  async createPersistentVolumeClaim(
    name: string, namespace: string, storageGb: number, storageClassName: string,
    accessModes: 'ReadWriteMany' | 'ReadWriteOnce',
    labels?: {[key: string]: string },
  ) {
    const pvcTemplateJson = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        namespace,
        name: `pv-${name}-claim`,
        labels: { ...labels, app: name, ainConnect: 'yes' },
      },
      spec: {
        accessModes: [accessModes],
        resources: { requests: { storage: `${storageGb}Gi` } },
      },
    };
    if (storageClassName !== '') {
      pvcTemplateJson.spec['storageClassName'] = storageClassName;
    }
    const result = await this.apply(pvcTemplateJson);
    return result;
  }

  /**
   * Create PersistentVolume and PersistentVolumeClaim.
   * @params name: Storage Name.
   * @params namespace: Namespace Name.
   * @params storageGb: storageGb.
   * @params storageClassName: k8s storageClass Name.
   * @params accessModes: ReadWriteMany or ReadWriteOnce.
   * @params nfsInfo: NFS Server Base Path +  NFS Server Address.
   * @params labels: labels.
  */
  async createStorage(
    name: string, namespace: string, storageGb: number, storageClassName: string,
    accessModes: 'ReadWriteMany' | 'ReadWriteOnce',
    nfsInfo?: types.NfsInfo, labels?: {[key: string]: string },
  ) {
    const pvResult = await this.createPersistentVolume(
      name, namespace, storageGb, storageClassName, accessModes, nfsInfo, labels,
    );
    const pvcResult = await this.createPersistentVolumeClaim(
      name, namespace, storageGb, storageClassName, accessModes, labels,
    );
    return { pvResult, pvcResult };
  }

  /**
   * Create NFS Server in Cluster.
   * @params name: Storage Name.
   * @params capacity: storageGb.
   * @params resourceLimits: k8s resourceLimits.
   * @params storageClassName: k8s storageClass Name.
   * @params accessModes: ReadWriteMany or ReadWriteOnce.
   * @params labels: labels.
   * @params  nodePoolLabel: params for select nodePool.
   *          [if it is undefined then select from all nodepool]
   * @returns clusterIp
  */
  async createLocalNfsServer(name: string, capacity: number,
    resourceLimits: types.HwSpec, storageClassName: string,
    accessModes: 'ReadWriteMany' | 'ReadWriteOnce',
    labels?: { [key: string]: string }, nodePoolLabel?: Object) {
    const nfsName = `nfs-${name}`;

    await this.createPersistentVolumeClaim(nfsName, 'default',
      capacity, storageClassName, accessModes, labels);

    await this.createDeployment(nfsName, 'default', {
      imagePath: 'k8s.gcr.io/volume-nfs:0.8',
      ports: [2049, 111, 20048],
      resourceLimits,
    }, {
      [nfsName]: {
        mountPath: '/exports',
      },
    }, undefined, undefined, labels, nodePoolLabel, 1, true);

    const result = await this.createService(nfsName, 'default', [2049, 111, 20048], labels);

    return result['spec']['clusterIP'];
  }

  /**
   * Delete NFS Server in Cluster.
   * @params name: Storage Name.
  */
  async deleteLocalNfsServer(name: string) {
    const nfsName = `nfs-${name}`;
    await this.deleteResource('service', nfsName, 'default');
    await this.deleteResource('deployment', nfsName, 'default');
    await this.deleteResource('persistentVolumeClaim', nfsName, 'default');
  }

  /**
   * Get Secret Data for Private Docker Registry.
   * @params username: Private Docker Registry Username.
   * @params password: Private Docker Registry Password.
   * @params server: Private Docker Registry Addr.
  */
  getDockerSecretData(username: string, password: string, server: string) {
    const auth = Base64.encode(`${username}:${password}`);
    const rawData = {
      auths: {},
    };
    rawData.auths[server] = {
      username,
      password,
      auth,
    };

    return {
      '.dockerconfigjson': JSON.stringify(rawData),
    };
  }

  /**
   * Create Secret.
   * @params name: Secret Name.
   * @params namespace: Namespace Name.
   * @params type: Secret Type (ex. Opaque).
   * @params data: Secret Data.
  */
  async createSecret(
    name: string, namespace: string,
    type: string, data: {[key: string]: string},
  ) {
    const base64Data = {};
    for (const key of Object.keys(data)) {
      base64Data[key] = Base64.encode(data[key]);
    }
    await this.coreApi.createNamespacedSecret(namespace, {
      apiVersion: 'v1',
      kind: 'Secret',
      type,
      metadata: {
        name,
        labels: {
          ainConnect: 'yes',
        },
      },
      data: base64Data,
    });
  }

  /**
   * Create Secret for Private Docker Repository.
   * @params name: Secret Name.
   * @params namespace: Namespace Name.
   * @params username: Private Docker Registry Username.
   * @params password: Private Docker Registry Password.
   * @params server: Private Docker Registry Addr.
  */
  async createDockerSecret(
    name: string, namespace: string,
    username: string, password: string, server: string,
  ) {
    const data = this.getDockerSecretData(username, password, server);
    await this.createSecret(name, namespace, 'kubernetes.io/dockerconfigjson', data);
  }

  /**
   * Delete VirtualService
   * @params name: VirtualService Name.
   * @params namespace: Namespace Name.
  */
  async deleteVirtualService(name: string, namespace: string) {
    let opts = {} as request.Options;
    this.config.applyToRequest(opts);
    opts = {
      qs: {
        labelSelector: `app=${name}`,
      },
      ...opts,
    };
    const url = `${this.serverAddr}/apis/networking.istio.io/v1alpha3/namespaces/${namespace}/virtualservices`;

    return new Promise((resolve, reject) => {
      request.delete(url, opts,
        (error, _response, _body) => {
          const json = JSON.parse(_body);
          if (error) {
            reject(error);
          }
          if (json.items.length === 0) {
            reject(new Error('not Exists'));
          }
          resolve(true);
        });
    });
  }

  /**
   * Delete K8s Resource (ex, namespace,...).
   * @params type: K8s Resource Type.
   * @params namespace: Namespace Name.
  */
  async deleteResource(type: types.Resource, name: string, namespace?: string) {
    if (type === 'namespace') {
      await this.coreApi.deleteNamespace(name);
    } else if (type === 'deployment' && namespace) {
      await this.appV1Api.deleteNamespacedDeployment(name, namespace);
    } else if (type === 'service' && namespace) {
      await this.coreApi.deleteNamespacedService(`${name}-lb`, namespace);
    } else if (type === 'virtualService' && namespace) {
      await this.deleteVirtualService(name, namespace);
    } else if (type === 'persistentVolume') {
      await this.coreApi.deletePersistentVolume(`pv-${name}`);
    } else if (type === 'persistentVolumeClaim' && namespace) {
      await this.coreApi.deleteNamespacedPersistentVolumeClaim(`pv-${name}-claim`, namespace);
    } else if (type === 'storage' && namespace) {
      await this.coreApi.deleteNamespacedPersistentVolumeClaim(`pv-${name}-claim`, namespace);
      await this.coreApi.deletePersistentVolume(`pv-${name}`);
    } else {
      throw 'Invalid Params';
    }
  }

  /**
   * Get Pod Information.
   * @params name: App Name about pod Label.
   * @params namespace: Namespace Name.
  */
  async getPodInfo(name: string, namespace: string) {
    const res = await this.coreApi.listNamespacedPod(
      namespace, undefined, undefined, undefined, undefined, `app=${name}`,
    );
    const podInfo = res.body.items[0];
    if (podInfo && podInfo.status && podInfo.spec) {
      const containerInfo = podInfo.spec.containers[0];
      const port = {};
      if (containerInfo.ports) {
        for (const portInfo of containerInfo.ports) {
          port[portInfo.containerPort] = portInfo.protocol;
        }
      }
      return {
        resourceStatus: podInfo.status.phase || 'Unknown',
        containerImage: containerInfo.image,
        env: containerInfo.env,
        port,
      };
    }
    return undefined;
  }

  /**
   * Get Node Information.
   * @params nodePoolLabel: label for finding NodePool.
   * @params namespace: Namespace Name.
  */
  async getNodesInfo(nodePoolLabel: string, gpuTypeLabel: string) {
    const url = `${this.serverAddr}/api/v1/nodes`;
    const opts = {} as request.Options;
    this.config.applyToRequest(opts);
    return new Promise<types.NodePool>((resolve, reject) => {
      request.get(url, opts,
        (error, _response, _body) => {
          if (error) {
            reject();
          }
          try {
            const nodePool = {};
            const nodes = JSON.parse(_body).items;
            for (const node of nodes) {
              const nodePoolName = node.metadata.labels[nodePoolLabel];
              const gpuType = node.metadata.labels[gpuTypeLabel];
              if (nodePoolName) {
                if (!nodePool[nodePoolName]) {
                  nodePool[nodePoolName] = JSON.parse(JSON.stringify({
                    gpuType: gpuType || '',
                    osImage: node.status.nodeInfo.osImage,
                    nodes: {},
                  }));
                }
                nodePool[nodePoolName].nodes[node.metadata.name] = {
                  capacity: this.convertHwSpecNumber(node.status.capacity),
                  allocatable: this.convertHwSpecNumber(node.status.allocatable),
                };
              }
            }
            resolve(nodePool);
          } catch (_) {
            reject(_);
          }
        });
    });
  }

  /**
   * Get Pod Resource Limits using Container Specs.
   * @params containers: Containers in Pod.
  */
  getPodLimit(containers: k8s.V1Container[]) {
    const limits = {
      cpu: 0,
      memory: 0,
      gpu: 0,
    };
    for (const container of containers) {
      if (container.resources && container.resources.limits) {
        if (container.resources.limits.cpu) {
          limits.cpu += this.convertUnitCpu(container.resources.limits.cpu);
        }
        if (container.resources.limits.memory) {
          limits.memory += this.convertUnitMemory(container.resources.limits.memory);
        }
        if (container.resources.limits['nvidia.com/gpu']) {
          limits.gpu += parseInt(container.resources.limits['nvidia.com/gpu'], 10);
        }
      }
    }
    return limits;
  }

  /**
   * Get All persistentvolumes Information.
   * @params selectLabel: label for selecting persistentvolumes
  */
  async getStorageInfos(selectLabel?: string) {
    const url = `${this.serverAddr}/api/v1/persistentvolumes`;

    return new Promise<types.StorageInfo[]>((resolve, reject) => {
      const opts = {} as request.Options;
      this.config.applyToRequest(opts);
      request.get(url, opts,
        (error, _response, _body) => {
          if (error) {
            reject(error);
          }
          const storageInfos = [];
          const jsonData = JSON.parse(_body);
          for (const item of jsonData.items) {
            if (item.metadata.labels && item.metadata.labels.app
              && (!selectLabel || (item.metadata.labels[selectLabel]))
            ) {
              const storageInfo = {
                storageId: item.metadata.labels.app,
                isConnectStorage: !!(item.metadata.labels.ainConnect),
                status: item.status.phase as types.StorageStatus,
                claim: {
                  name: item.spec.claimRef.name,
                  namespaceId: item.spec.claimRef.namespace,
                },
              };
              storageInfos.push(storageInfo);
            }
          }
          resolve(storageInfos);
        });
    });
  }

  /**
   * Get All Pod Information.
  */
  async getPodInfos() {
    const url = `${this.serverAddr}/api/v1/pods`;

    return new Promise<types.PodInfo[]>((resolve, reject) => {
      const opts = {} as request.Options;
      this.config.applyToRequest(opts);
      request.get(url, opts,
        (error, _response, _body) => {
          if (error) {
            reject(error);
          }
          const podInfos = [];
          const jsonData = JSON.parse(_body);
          for (const item of jsonData.items) {
            const limits = this.getPodLimit(item.spec.containers);
            const data = {
              allResourcelimits: limits,
              isConnectPod: !!(item.metadata.labels.ainConnect),
              containerId: item.metadata.labels.app,
              targetNodeName: item.spec.nodeName,
              name: item.metadata.name,
              namespaceId: item.metadata.namespace,
              status: {
                phase: item.status.phase,
                message: item.status.message,
                startTime: item.status.startTime,
                condition: (item.status.conditions) ? {
                  type: item.status.conditions[0].type,
                  status: item.status.conditions[0].status,
                  reason: item.status.conditions[0].reason,
                  message: item.status.conditions[0].message,
                } : undefined,
              },
            };
            podInfos.push(data);
          }
          resolve(podInfos);
        });
    });
  }

  // API:EXIST

  /**
   * existDeployment
   * @params name: Deployment Name.
   * @params namespace: Namespace Name.
  */
  async existDeployment(name: string, namespace: string) {
    try {
      await this.appV1Api.readNamespacedDeploymentStatus(name, namespace);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * existStorage
   * @params name: Storage Name.
  */
  async existStorage(name: string, namespace: string) {
    try {
      await this.coreApi.readNamespacedPersistentVolumeClaim(`pv-${name}-claim`, namespace);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * existSecret
   * @params name: Secret Name.
   * @params namespace: namespace Name.
  */
  async existSecret(name: string, namespace: string) {
    try {
      await this.coreApi.readNamespacedSecret(name, namespace);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * existNamespace
   * @params name: Namespace Name.
  */
  async existNamespace(name: string) {
    try {
      await this.coreApi.readNamespace(name);
      return true;
    } catch (_) {
      return false;
    }
  }

  // API:PATCH

  /**
   * Configrate Deployment
   * @params name: Deployment Name.
   * @params namespace: namespace Name.
   * @params env: deployment and pod Env.
   * @params replicas: Number of pods.
   * @params imagePath: Docker Image Path.
  */
  async patchDeployment(name: string, namespace: string,
    env?: Object, replicas?: number, imagePath?: string) {
    try {
      const patch = [];
      if (replicas !== undefined) {
        patch.push({
          op: 'replace',
          path: '/spec/replicas',
          value: replicas,
        });
      }
      if (imagePath) {
        patch.push({
          op: 'replace',
          path: '/spec/template/spec/containers/0/image',
          value: imagePath,
        });
      }

      if (env) {
        const envValue = [];
        for (const key of Object.keys(env)) {
          envValue.push({
            name: key,
            value: String(env[key]),
          });
        }
        patch.push({
          op: 'replace',
          path: '/spec/template/spec/containers/0/env',
          value: envValue,
        });
      }
      if (patch.length !== 0) {
        const options = { headers: { 'Content-type': 'application/json-patch+json' } };
        await this.appV1Api.patchNamespacedDeployment(name, namespace, patch,
          undefined, undefined, undefined, undefined, options);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Parse Pod Information From k8s.V1Pod
   * @params pod: k8s.V1Pod
  */
  parsePodInfo(pod: k8s.V1Pod) {
    if (pod.spec && pod.metadata && pod.status && pod.metadata.labels && pod.status.conditions) {
      const { containers } = pod.spec;
      const allResourcelimits = this.getPodLimit(containers);
      const podInfo = {
        targetNodeName: pod.spec.nodeName as string,
        allResourcelimits,
        containerId: pod.metadata.labels.app,
        isConnectPod: !!(pod.metadata.labels.ainConnect),
        name: pod.metadata.name as string,
        namespaceId: pod.metadata.namespace as string,
        status: {
          phase: pod.status.phase as types.PodPhase,
          message: pod.status.message,
          startTime: String(pod.status!.startTime),
          condition: {
            type: pod.status.conditions[0].type as types.PodCondition,
            status: (pod.status.conditions[0].status === 'True'),
            reason: pod.status.conditions[0].reason,
            message: pod.status.conditions[0].message,
          },
        },
      };
      return podInfo;
    }
    return undefined;
  }

  /**
   * Watch Pod.
  */
  async makeInformerPod(
    addCallback: (data: types.PodInfo) => void,
    updateCallback: (data: types.PodInfo) => void,
    deleteCallback: (data: types.PodInfo) => void,
    errorCallback: () => void,
  ) {
    const listFn = () => this.coreApi.listPodForAllNamespaces();
    const informer = k8s.makeInformer(this.config, '/api/v1/pods', listFn);

    informer.on('add', async (obj: k8s.V1Pod) => {
      const podInfo = this.parsePodInfo(obj);
      if (podInfo) {
        await addCallback(podInfo);
      }
    });
    informer.on('update', async (obj: k8s.V1Pod) => {
      const podInfo = this.parsePodInfo(obj);
      if (podInfo) {
        await updateCallback(podInfo);
      }
    });
    informer.on('delete', async (obj: k8s.V1Pod) => {
      const podInfo = this.parsePodInfo(obj);
      if (podInfo) {
        await deleteCallback(podInfo);
      }
    });
    informer.on('error', async (err: k8s.V1Pod) => {
      // eslint-disable-next-line no-console
      console.log(err);
      await errorCallback();
      // Restart informer after 5sec
      setTimeout(() => {
        informer.start();
      }, 5000);
    });
    informer.start();
  }

  /**
   * Parse PersistentVolume Information From k8s.V1PersistentVolume.
   * @params pv: k8s.V1PersistentVolume.
  */
  parsePersistentVolumeInfo(pv: k8s.V1PersistentVolume) {
    if (pv.metadata && pv.metadata.labels && pv.status && pv.spec && pv.spec.claimRef) {
      const pvInfo = {
        storageId: pv.metadata.labels.app,
        isConnectStorage: !!(pv.metadata.labels.ainConnect),
        status: pv.status.phase as types.StorageStatus,
        claim: {
          name: pv.spec.claimRef.name as string,
          namespaceId: pv.spec.claimRef.namespace as string,
        },
      };
      return pvInfo;
    }
    return undefined;
  }

  /**
   * Watch Persistent Volume.
  */
  async makeInformerStorage(
    addCallback: (data: types.StorageInfo) => void,
    updateCallback: (data: types.StorageInfo) => void,
    deleteCallback: (data: types.StorageInfo) => void,
    errorCallback: () => void,
  ) {
    const listFn = () => this.coreApi.listPersistentVolume();
    const informer = k8s.makeInformer(this.config, '/api/v1/persistentvolumes', listFn);

    informer.on('add', async (obj: k8s.V1PersistentVolume) => {
      const persistentVolumeInfo = this.parsePersistentVolumeInfo(obj);
      if (persistentVolumeInfo) {
        await addCallback(persistentVolumeInfo);
      }
    });
    informer.on('update', async (obj: k8s.V1PersistentVolume) => {
      const persistentVolumeInfo = this.parsePersistentVolumeInfo(obj);
      if (persistentVolumeInfo) {
        await updateCallback(persistentVolumeInfo);
      }
    });
    informer.on('delete', async (obj: k8s.V1PersistentVolume) => {
      const persistentVolumeInfo = this.parsePersistentVolumeInfo(obj);
      if (persistentVolumeInfo) {
        await deleteCallback(persistentVolumeInfo);
      }
    });
    informer.on('error', async (err: k8s.V1PersistentVolume) => {
      // eslint-disable-next-line no-console
      console.log(err);
      await errorCallback();
      // Restart informer after 5sec
      setTimeout(() => {
        informer.start();
      }, 5000);
    });

    informer.start();
  }
}
