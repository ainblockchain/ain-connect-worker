import * as k8s from '@kubernetes/client-node';
import * as request from 'request';

type HwSpec = {
  cpu: string;
  gpu?: number;
  memory: string;
};

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

type apiVersion = 'v1alpha3';

export async function deleteVirtualService(
  kubeConfig: k8s.KubeConfig, apiVersion: apiVersion, name: string, namespace: string,
) {
  const opts = {};
  kubeConfig.applyToRequest(opts as request.Options);
  const url = `${kubeConfig.getCurrentCluster()!.server}/apis/networking.istio.io/${apiVersion}/namespaces/${namespace}/virtualservices/${name}`;

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

export async function getPodInfo(kubeConfig: k8s.KubeConfig, namespace: string, name: string) {
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  const res = await k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `app=${name}`);
  if (res.body.items[0].status && res.body.items[0].status.conditions) {
    const { conditions } = res.body.items[0].status;
    const finalcondition = conditions[conditions.length - 1];
    return { ...finalcondition };
  }
  throw new Error('-1');
}

export function getNamespaceJson(name: string) {
  const templateJson = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name,
    },
  };
  return templateJson;
}

export function getDeploymentJson(
  name: string, namespace: string, image: string,
  env?: Object, hwSpec?: HwSpec,
  portList?: number[], storageNameList?: string[],
) {
  const templateJson = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      namespace,
      labels: { app: name, templateVersion: '1' },
      name,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          containers: [
            {
              image,
              imagePullPolicy: 'Always',
              name,
              ports: [] as Object[],
              volumeMounts: [] as Object[],
              resources: {},
              env: [] as Object[],
            },
          ],
          volumes: [] as Object[],
        },
      },
    },
  };

  if (hwSpec) {
    templateJson.spec.template.spec.containers[0].resources = {
      requests: {
        cpu: hwSpec.cpu,
        memory: hwSpec.memory,
        'nvidia.com/gpu': hwSpec.gpu,
      },
      limits: {
        cpu: hwSpec.cpu,
        memory: hwSpec.memory,
        'nvidia.com/gpu': hwSpec.gpu,
      },
    };
  }

  if (env) {
    for (const key of Object.keys(env)) {
      templateJson.spec.template.spec.containers[0].env.push({
        name: key,
        value: env[key],
      });
    }
  }

  if (portList) {
    for (const port of portList) {
      templateJson.spec.template.spec.containers[0].ports.push({
        containerPort: port,
      });
    }
  }

  if (storageNameList) {
    for (const storageName of storageNameList) {
      templateJson.spec.template.spec.volumes.push({
        name: `${storageName}-ps`,
        persistentVolumeClaim: { claimName: `pv-${storageName}-claim` },
      });
      templateJson.spec.template.spec.containers[0].volumeMounts.push({
        name: `${storageName}-ps`,
        mountPath: '/home/storage',
        subPath: storageName,
      });
    }
  }
  return templateJson;
}

export function getServiceJson(name: string, namespace: string, portList: Object) {
  const templateJson = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      namespace,
      labels: { app: name, templateVersion: '3' },
      name: `${name}-lb`,
    },
    spec: {
      ports: [] as Object[],
      selector: { app: name },
    },
  };

  for (const port of Object.keys(portList)) {
    templateJson.spec.ports.push({ name: `tcp${port}`, port, targetPort: portList[port] });
  }
  return templateJson;
}

export function getVirtualServiceJson(
  name: string, namespace: string, endpoint: string, gateway: string, port: number,
) {
  const templateJson = {
    apiVersion: 'networking.istio.io/v1alpha3',
    kind: 'VirtualService',
    metadata: {
      name: `${name}-vsvc`,
      namespace,
      labels: { app: name, templateVersion: '3' },
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
  return templateJson;
}

export function getStorageJson(
  name: string, namespace: string, serverIp: string, nfsPath: string, storageGb: string,
) {
  const pvTemplateJson = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: {
      namespace,
      name: `pv-${name}`,
      labels: { app: name },
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
  return { pvTemplateJson, pvcTemplateJson };
}
