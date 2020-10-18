import * as k8s from '@kubernetes/client-node';
import * as request from 'request';
import { Base64 } from 'js-base64';

export type HwSpec = {
  cpu: string;
  gpu: number;
  memory: string;
};

export type ContainerSpec = {
  image: string,
  hwSpec: HwSpec,
  env?: Object,
  ports?: number[],

}

export type StorageSpec = {
  name: string,
  mountPath: string,
  subPath?: string,
}

export type PhaseList = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
export type ConditionType = 'Initialized' | 'Ready' | 'ContainersReady' | 'PodScheduled';

export type PodInfo = {
  containerId: string,
  podName: string,
  namespace: string,
  status: {
    phase: PhaseList,
    message?: string
    startTime?: string
    condition: {
      type: ConditionType,
      status: boolean,
      resson?: string,
      message?: string,
    }
  }
}

export type NodeInfo = {
  nodepool: string,
  name: string,
  osImage: string,
  capacity: {
    cpu: string,
    memory: string,
    gpu?: string,
  },
  allocatable: {
    cpu: string,
    memory: string,
    gpu?: string,
  },
}

export type storageInfo = {
  name: string,
  phase: string, // TODO
  claim: {
    name: string,
    namespace: string,
  },
}

export async function apply(kubeConfig: k8s.KubeConfig, kubeJson: k8s.KubernetesObject) {
  const client = k8s.KubernetesObjectApi.makeApiClient(kubeConfig);
  kubeJson.metadata = kubeJson.metadata || {};
  kubeJson.metadata.annotations = kubeJson.metadata.annotations || {};
  kubeJson.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(kubeJson);

  try {
    await client.read(kubeJson);
    const response = await client.patch(kubeJson);
    return response.body;
  } catch (e) {
    const response = await client.create(kubeJson);
    return response.body;
  }
}

// API:CREATE
export async function createNamespace(kubeConfig: k8s.KubeConfig, name: string) {
  const templateJson = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name,
    },
  };

  const result = await apply(kubeConfig, templateJson);
  return result;
}

export async function createDeployment(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string, containerSpec: ContainerSpec,
  storageSpecList: StorageSpec[], imagePullSecretName?: string,
  labels?: {[key: string]: string}, nodePoolLabel?: Object, replicas?: number,
) {
  const templateJson = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      namespace,
      labels: { ...labels, app: name, templateVersion: '1' },
      name,
    },
    spec: {
      replicas: replicas || 1,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          nodeSelector: nodePoolLabel || {},
          containers: [
            {
              image: containerSpec.image,
              imagePullPolicy: 'Always',
              name,
              ports: [] as Object[],
              volumeMounts: [] as Object[],
              env: [] as Object[],
              resources: {
                requests: {
                  cpu: containerSpec.hwSpec.cpu,
                  memory: containerSpec.hwSpec.memory,
                  'nvidia.com/gpu': containerSpec.hwSpec.gpu,
                },
                limits: {
                  cpu: containerSpec.hwSpec.cpu,
                  memory: containerSpec.hwSpec.memory,
                  'nvidia.com/gpu': containerSpec.hwSpec.gpu,
                },
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

  if (storageSpecList) {
    for (const storageSpec of storageSpecList) {
      templateJson.spec.template.spec.volumes.push({
        name: `${storageSpec.name}-ps`,
        persistentVolumeClaim: { claimName: `pv-${storageSpec.name}-claim` },
      });
      templateJson.spec.template.spec.containers[0].volumeMounts.push(JSON.parse(JSON.stringify({
        name: `${storageSpec.name}-ps`,
        mountPath: storageSpec.mountPath,
        subPath: storageSpec.subPath,
      })));
    }
  }

  const result = await apply(kubeConfig, templateJson);
  return result;
}

export async function createService(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  ports: number[], labels: {[key: string]: string },
) {
  const templateJson = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      namespace,
      labels: { ...labels, app: name, templateVersion: '3' },
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

  const result = await apply(kubeConfig, templateJson);
  return result;
}

export async function creteaVirtualService(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  endpoint: string, gateway: string, port: number, labels: {[key: string]: string },
) {
  const templateJson = {
    apiVersion: 'networking.istio.io/v1alpha3',
    kind: 'VirtualService',
    metadata: {
      name: `${name}-vsvc${port}`,
      namespace,
      labels: { ...labels, app: name, templateVersion: '3' },
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

  const result = await apply(kubeConfig, templateJson);
  return result;
}

export async function createStorage(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  serverIp: string, nfsPath: string, storageGb: string, labels: {[key: string]: string },
) {
  const pvTemplateJson = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: {
      namespace,
      name: `pv-${name}`,
      labels: { ...labels, app: name },
    },
    spec: {
      capacity: { storage: storageGb },
      accessModes: ['ReadWriteMany'],
      storageClassName: name,
      nfs: { path: nfsPath, server: serverIp },
      persistentVolumeReclaimPolicy: 'Retain',
    },
  };

  const pvcTemplateJson = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      namespace,
      name: `pv-${name}-claim`,
      labels: { app: name },
    },
    spec: {
      accessModes: ['ReadWriteMany'],
      storageClassName: name,
      resources: { requests: { storage: storageGb } },
    },
  };

  const pvResult = await apply(kubeConfig, pvTemplateJson);
  const pvcResult = await apply(kubeConfig, pvcTemplateJson);
  return { pvResult, pvcResult };
}

export async function createDockerSecret(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  username: string, password: string, server: string,
) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  const auth = Base64.encode(`${username}:${password}`);
  const rawData = {
    auths: {},
  };
  rawData.auths[server] = {
    username,
    password,
    auth,
  };

  await k8sApi.createNamespacedSecret(namespace, {
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'kubernetes.io/dockerconfigjson',
    metadata: {
      name,
    },
    data: {
      '.dockerconfigjson': Base64.encode(JSON.stringify(rawData)),
    },
  });
}

// API:DELETE
export async function deleteNamespace(kubeConfig: k8s.KubeConfig, name: string) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  await k8sApi.deleteNamespace(name);
}

export async function deleteDeployment(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
) {
  const k8sApi = kubeConfig.makeApiClient(k8s.AppsV1Api);
  await k8sApi.deleteNamespacedDeployment(name, namespace);
}

export async function deleteService(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  await k8sApi.deleteNamespacedService(`${name}-lb`, namespace);
}

export async function deleteVirtualService(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
) {
  let opts = {};
  kubeConfig.applyToRequest(opts as request.Options);
  opts = {
    qs: {
      labelSelector: `app=${name}`,
    },
    ...opts,
  };
  const url = `${kubeConfig.getCurrentCluster()!.server}/apis/networking.istio.io/v1alpha3/namespaces/${namespace}/virtualservices`;

  return new Promise((resolve, reject) => {
    request.delete(url, opts,
      (error, _response, _body) => {
        if (error) {
          reject();
        }
        resolve(true);
      });
  });
}

export async function deleteStorage(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  await k8sApi.deleteNamespacedPersistentVolumeClaim(`pv-${name}-claim`, namespace);
  await k8sApi.deletePersistentVolume(`pv-${name}`);
}

// API:GET_CLUSTER_INFO
export async function getPodInfo(kubeConfig: k8s.KubeConfig, name: string, namespace: string) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  const res = await k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `app=${name}`);
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
  throw new Error('-1');
}

export async function watchPods(kubeConfig: k8s.KubeConfig, callback: (data: PodInfo) => void) {
  const watch = new k8s.Watch(kubeConfig);
  await watch.watch('/api/v1/pods', {},
    // callback is called for each received object.
    (type, apiObj, _) => {
      const { namespace } = apiObj.metadata;
      if (namespace !== 'kube-system' && namespace !== 'istio-system'
        && (type === 'ADDED' || type === 'MODIFIED')) {
        const data = {
          containerId: apiObj.metadata.labels.app,
          podName: apiObj.metadata.name,
          namespace,
          status: {
            phase: apiObj.status.phase,
            message: apiObj.status.message,
            startTime: apiObj.status.startTime,
            condition: {
              type: apiObj.status.conditions[0].type,
              status: apiObj.status.conditions[0].status,
              resson: apiObj.status.conditions[0].resson,
              message: apiObj.status.conditions[0].message,
            },
          },
        };
        callback(data);
      }
    },
    (_) => {});
}

export async function watchNodes(
  kubeConfig: k8s.KubeConfig, nodepoolLabel: string, callback: (data: NodeInfo) => void,
) {
  const watch = new k8s.Watch(kubeConfig);
  await watch.watch('/api/v1/nodes', {},
    // callback is called for each received object.
    (type, apiObj, _) => {
      if (apiObj.metadata.labels && apiObj.metadata.labels[nodepoolLabel]) {
        const data = {
          nodepool: apiObj.metadata.labels[nodepoolLabel],
          name: apiObj.metadata.name,
          osImage: apiObj.status.nodeInfo.osImage,
          capacity: {
            cpu: apiObj.status.capacity.cpu,
            memory: apiObj.status.capacity.memory,
            gpu: apiObj.status.capacity['nvidia.com/gpu'],
          },
          allocatable: {
            cpu: apiObj.status.allocatable.cpu,
            memory: apiObj.status.allocatable.memory,
            gpu: apiObj.status.allocatable['nvidia.com/gpu'],
          },
        };
        callback(data);
      }
    },
    (_) => {});
}

export async function watchStorage(
  kubeConfig: k8s.KubeConfig, callback: (data: storageInfo) => void,
) {
  const watch = new k8s.Watch(kubeConfig);
  await watch.watch('/api/v1/persistentvolumes', {},
    // callback is called for each received object.
    (type, apiObj, _) => {
      const data = {
        name: apiObj.metadata.name,
        phase: apiObj.status.phase,
        claim: {
          name: apiObj.spec.claimRef.name,
          namespace: apiObj.spec.claimRef.namespace,
        },
      };
      callback(data);
    },
    (_) => {});
}
