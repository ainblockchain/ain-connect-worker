import * as k8s from '@kubernetes/client-node';
import * as request from 'request';
import { Base64 } from 'js-base64';

export type TypeHwSpec = {
  cpu: number; // 'm'
  gpu: number;
  memory: number; // 'Mi'
};

export type TypeContainerSpec = {
  imagePath: string, // DOCKER IMAGE URL
  hwSpec: TypeHwSpec,
  env?: Object, // { ENV_NAME: ENV_VALUE }
  ports?: number[], // Internal Port List
}

export type TypeStorageSpecs = {
  [storageId: string]: {
    mountPath: string,
    subPath?: string,
    isSecret?: boolean,
  }
}

/*
  Available -- a free resource that is not yet bound to a claim
  Bound     -- the volume is bound to a claim
  Released  -- the claim has been deleted, but the resource is not yet reclaimed by the cluster
  Failed    -- the volume has failed its automatic reclamation
*/
export type TypeStorageStatus = 'Available' | 'Bound' | 'Released' | 'Failed';

/*
  Pending --  The Pod has been accepted by the Kubernetes cluster,
              but one or more of the containers has not been set up and made ready to run.
              This includes time a Pod spends waiting to be scheduled as well as
              the time spent downloading container images over the network.
  Running --  The Pod has been bound to a node, and all of the containers have been created.
              At least one container is still running, or is in the process of
              starting or restarting.
              Succeeded All containers in the Pod have terminated in success,
              and will not be restarted.
  Failed  --  All containers in the Pod have terminated,
              and at least one container has terminated in failure.
              That is, the container either exited with non-zero status or
              was terminated by the system.
  Unknown --  For some reason the state of the Pod could not be obtained.
              This phase typically occurs due to an error in communicating
              with the node where the Pod should be running.
*/
export type TypePodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

/*
  PodScheduled    -- the Pod has been scheduled to a node.
  ContainersReady -- all containers in the Pod are ready.
  Initialized     -- all init containers have started successfully.
  Ready           -- the Pod is able to serve requests and should be added to
                     the load balancing pools of all matching Services.
*/
export type TypeContainerCondition = 'Initialized' | 'Ready' | 'ContainersReady' | 'PodScheduled';

export type TypePodInfo = {
  podName: string,
  namespaceId: string,
  status: {
    phase: TypePodPhase,
    message?: string
    startTime?: string
    condition: {
      type: TypeContainerCondition,
      status: boolean,
      reason?: string,
      message?: string,
    }
  }
}

export type TypeNodeInfo = {
  labels: { [key: string]: string},
  name: string,
  osImage: string,
  capacity: {
    cpu: number,
    memory: number,
    gpu: number,
  },
  allocatable: {
    cpu: number,
    memory: number,
    gpu: number,
  },
}

export type TypeStorageInfo = {
  type: string,
  storageId: string,
  status: TypeStorageStatus,
  claim: {
    name: string,
    namespaceId: string,
  },
}

export async function apply(kubeConfig: k8s.KubeConfig, kubeJson: k8s.KubernetesObject) {
  const client = k8s.KubernetesObjectApi.makeApiClient(kubeConfig);
  kubeJson.metadata = kubeJson.metadata || {};
  kubeJson.metadata.annotations = kubeJson.metadata.annotations || {};
  kubeJson.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(kubeJson);

  try {
    // If it already exists, modify
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
  kubeConfig: k8s.KubeConfig, name: string, namespace: string, containerSpec: TypeContainerSpec,
  storageSpecs?: TypeStorageSpecs, imagePullSecretName?: string,
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
              image: containerSpec.imagePath,
              imagePullPolicy: 'Always',
              name,
              ports: [] as Object[],
              volumeMounts: [] as Object[],
              env: [] as Object[],
              resources: {
                requests: {
                  cpu: `${containerSpec.hwSpec.cpu}m`,
                  memory: `${containerSpec.hwSpec.memory}Mi`,
                  'nvidia.com/gpu': String(containerSpec.hwSpec.gpu),
                },
                limits: {
                  cpu: containerSpec.hwSpec.cpu,
                  memory: containerSpec.hwSpec.memory,
                  'nvidia.com/gpu': String(containerSpec.hwSpec.gpu),
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

  if (storageSpecs) {
    for (const storageId of Object.keys(storageSpecs)) {
      // Mount Secret.
      if (storageSpecs[storageId].isSecret) {
        templateJson.spec.template.spec.volumes.push({
          name: storageId,
          secret: {
            secretName: storageId,
          },
        });
        templateJson.spec.template.spec.containers[0].volumeMounts.push(JSON.parse(JSON.stringify({
          name: storageId,
          mountPath: storageSpecs[storageId].mountPath,
          subPath: storageSpecs[storageId].subPath,
        })));
      } else {
        // Mount PVC
        templateJson.spec.template.spec.volumes.push({
          name: `${storageId}-ps`,
          persistentVolumeClaim: { claimName: `pv-${storageId}-claim` },
        });
        templateJson.spec.template.spec.containers[0].volumeMounts.push(JSON.parse(JSON.stringify({
          name: `${storageId}-ps`,
          mountPath: storageSpecs[storageId].mountPath,
          subPath: storageSpecs[storageId].subPath,
        })));
      }
    }
  }

  const result = await apply(kubeConfig, templateJson);
  return result;
}

export async function createService(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  ports: number[], labels?: {[key: string]: string },
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
  endpoint: string, gateway: string, port: number, labels?: {[key: string]: string },
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
  serverIp: string, nfsPath: string, storageGb: string, labels?: {[key: string]: string },
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

export function getDockerSecretData(username: string, password: string, server: string) {
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

export async function createSecret(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  type: string, data: {[key: string]: string},
) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);

  const base64Data = {};
  for (const key of Object.keys(data)) {
    base64Data[key] = Base64.encode(data[key]);
  }
  await k8sApi.createNamespacedSecret(namespace, {
    apiVersion: 'v1',
    kind: 'Secret',
    type,
    metadata: {
      name,
    },
    data: base64Data,
  });
}

export async function createDockerSecret(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  username: string, password: string, server: string,
) {
  const data = getDockerSecretData(username, password, server);
  await createSecret(kubeConfig, name, namespace, 'kubernetes.io/dockerconfigjson', data);
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

export async function getNodesStatus(
  kubeConfig: k8s.KubeConfig, nodePoolLabel: string, gpuTypeLabel: string,
) {
  const opts = {};
  kubeConfig.applyToRequest(opts as request.Options);

  const url = `${kubeConfig.getCurrentCluster()!.server}/api/v1/nodes`;

  return new Promise((resolve, reject) => {
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
                nodePool[nodePoolName] = {
                  gpuType,
                  osImage: node.status.nodeInfo.osImage,
                  node: {},
                };
              }
              nodePool[nodePoolName].node[node.metadata.name] = {
                capacity: {
                  cpu: parseInt(node.status.capacity.cpu, 10),
                  memory: Math.round(parseInt(node.status.capacity.memory, 10) / 1000),
                  gpu: Number(node.status.capacity['nvidia.com/gpu']),
                },
                allocatable: {
                  cpu: parseInt(node.status.capacity.cpu, 10),
                  memory: Math.round(parseInt(node.status.capacity.memory, 10) / 1000),
                  gpu: Number(node.status.allocatable['nvidia.com/gpu']),
                },
              };
            }
          }
          resolve(nodePool);
        } catch (_) {
          reject();
        }
      });
  });
}

export async function watchPods(kubeConfig: k8s.KubeConfig, callback: (data: {
  podInfo: TypePodInfo,
  type: string,
  containerId: string,
}) => void) {
  const watch = new k8s.Watch(kubeConfig);
  await watch.watch('/api/v1/pods', {},
    (type, apiObj, _) => {
      const { namespace } = apiObj.metadata;
      if (namespace !== 'kube-system' && namespace !== 'istio-system') {
        const podInfo = {
          podName: apiObj.metadata.name,
          namespaceId: namespace,
          status: {
            phase: apiObj.status.phase,
            message: apiObj.status.message,
            startTime: apiObj.status.startTime,
            condition: {
              type: apiObj.status.conditions[0].type,
              status: apiObj.status.conditions[0].status,
              reason: apiObj.status.conditions[0].reason,
              message: apiObj.status.conditions[0].message,
            },
          },
        };
        if (apiObj.metadata.labels.app) {
          callback({
            containerId: apiObj.metadata.labels.app,
            type,
            podInfo,
          });
        }
      }
    },
    (_) => {});
}

export async function watchNodes(
  kubeConfig: k8s.KubeConfig, callback: (data: TypeNodeInfo) => void,
) {
  const watch = new k8s.Watch(kubeConfig);
  await watch.watch('/api/v1/nodes', {},
    // callback is called for each received object.
    (type, apiObj, _) => {
      if (apiObj.metadata.labels) {
        const data = {
          labels: apiObj.metadata.labels,
          name: apiObj.metadata.name,
          osImage: apiObj.status.nodeInfo.osImage,
          capacity: {
            cpu: parseInt(apiObj.status.capacity.cpu, 10),
            memory: Math.round(parseInt(apiObj.status.capacity.memory, 10) / 1000),
            gpu: Number(apiObj.status.capacity['nvidia.com/gpu']),
          },
          allocatable: {
            cpu: parseInt(apiObj.status.capacity.cpu, 10),
            memory: Math.round(parseInt(apiObj.status.capacity.memory, 10) / 1000),
            gpu: Number(apiObj.status.allocatable['nvidia.com/gpu']),
          },
        };
        callback(data);
      }
    },
    (_) => {});
}

export async function watchStorage(
  kubeConfig: k8s.KubeConfig, callback: (data: TypeStorageInfo) => void,
) {
  const watch = new k8s.Watch(kubeConfig);
  await watch.watch('/api/v1/persistentvolumes', {},
    // callback is called for each received object.
    (type, apiObj, _) => {
      const data = {
        type,
        storageId: apiObj.metadata.labels.app,
        status: apiObj.status.phase as TypeStorageStatus,
        claim: {
          name: apiObj.spec.claimRef.name,
          namespaceId: apiObj.spec.claimRef.namespace,
        },
      };
      if (apiObj.metadata.labels.app) {
        callback(data);
      }
    },
    (_) => {});
}

// API:EXIST
export async function existDeployment(kubeConfig: k8s.KubeConfig, name: string, namespace: string) {
  const k8sApi = kubeConfig.makeApiClient(k8s.AppsV1Api);
  try {
    await k8sApi.readNamespacedDeploymentStatus(name, namespace);
    return true;
  } catch (_) {
    return false;
  }
}

export async function existStorage(kubeConfig: k8s.KubeConfig, name: string) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  try {
    await k8sApi.readPersistentVolume(`pv-${name}`);
    return true;
  } catch (_) {
    return false;
  }
}

export async function existSecret(kubeConfig: k8s.KubeConfig, name: string, namespace: string) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  try {
    await k8sApi.readNamespacedSecret(name, namespace);
    return true;
  } catch (_) {
    return false;
  }
}

// API:PATCH
export async function patchDeployment(
  kubeConfig: k8s.KubeConfig, name: string, namespace: string,
  env?: Object, replicas?: number, image?: string,
) {
  const k8sApi = kubeConfig.makeApiClient(k8s.AppsV1Api);
  try {
    const patch = [];
    if (replicas !== undefined) {
      patch.push({
        op: 'replace',
        path: '/spec/replicas',
        value: replicas,
      });
    }
    if (image) {
      patch.push({
        op: 'replace',
        path: '/spec/template/spec/containers/0/image',
        value: image,
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
      await k8sApi.patchNamespacedDeployment(name, namespace, patch,
        undefined, undefined, undefined, undefined, options);
    }
    return true;
  } catch (_) {
    return false;
  }
}
