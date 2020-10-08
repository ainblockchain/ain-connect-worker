import * as k8s from '../../handler/k8sHandler';

const name = 'worker';
const namespace = 'ns';
const image = 'comcom/worker';
const env = { gpu: true };
const hwSpec = {
  cpu: '100m',
  memory: '100Mib',
  gpu: 1,
};
const endpoint = 'worker.ainetwork.ai';
const gateway = 'worker-gateway';
const serverIp = '10.10.10.10';
const nfsPath = '/worker';

describe('k8sHandler.test.ts', () => {
  it('getNamespaceJson', () => {
    const result = k8s.getNamespaceJson(name);
    expect(name).toEqual(result.metadata.name);
  });

  it('getDeploymentJson without portList, storageNameList, env, hwSpec', () => {
    const result = k8s.getDeploymentJson(name, namespace, image);
    expect(name).toEqual(result.metadata.labels.app);
    expect(name).toEqual(result.metadata.name);
    expect(namespace).toEqual(result.metadata.namespace);
    expect(image).toEqual(result.spec.template.spec.containers[0].image);
  });

  it('getDeploymentJson within env', () => {
    const result = k8s.getDeploymentJson(name, namespace, image, env);
    expect({ name: 'gpu', value: true }).toEqual(result.spec.template.spec.containers[0].env[0]);
  });

  it('getDeploymentJson within hwSpec', () => {
    const result = k8s.getDeploymentJson(name, namespace, image, undefined, hwSpec);
    expect({
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
    }).toEqual(result.spec.template.spec.containers[0].resources);
  });

  it('getDeploymentJson within portList', () => {
    const result = k8s.getDeploymentJson(name, namespace, image, undefined, undefined, [80, 81]);
    expect({ containerPort: 80 }).toEqual(result.spec.template.spec.containers[0].ports[0]);
  });

  it('getDeploymentJson within storageNameList', () => {
    const result = k8s.getDeploymentJson(name, namespace, image, undefined, undefined, undefined, ['sId1', 'sId2']);

    expect({
      name: 'sId1-ps',
      persistentVolumeClaim: { claimName: 'pv-sId1-claim' },
    }).toEqual(result.spec.template.spec.volumes[0]);

    expect({
      name: 'sId1-ps',
      mountPath: '/home/storage',
      subPath: 'sId1',
    }).toEqual(result.spec.template.spec.containers[0].volumeMounts[0]);
  });

  it('getServiceJson', () => {
    const result = k8s.getServiceJson(name, namespace, { 80: 81 });
    expect(`${name}-lb`).toEqual(result.metadata.name);
    expect(name).toEqual(result.metadata.labels.app);
    expect(namespace).toEqual(result.metadata.namespace);
    expect({ name: 'tcp80', port: '80', targetPort: 81 }).toEqual(result.spec.ports[0]);
  });

  it('getVirtualServiceJson', () => {
    const result = k8s.getVirtualServiceJson(name, namespace, endpoint, gateway, 80);
    expect(`${name}-vsvc80`).toEqual(result.metadata.name);
    expect(name).toEqual(result.metadata.labels.app);
    expect(namespace).toEqual(result.metadata.namespace);
    expect(endpoint).toEqual(result.spec.hosts[0]);
    expect(gateway).toEqual(result.spec.gateways[0]);
    expect({
      destination: { host: `${name}-lb`, port: { number: 80 } },
    }).toEqual(result.spec.http[0].route[0]);
  });

  it('getStorageJson', () => {
    const { pvTemplateJson, pvcTemplateJson } = k8s.getStorageJson(name, namespace, serverIp, nfsPath, '100Gib');
    expect(`pv-${name}`).toEqual(pvTemplateJson.metadata.name);
    expect(name).toEqual(pvTemplateJson.metadata.labels.app);
    expect(name).toEqual(pvTemplateJson.spec.storageClassName);
    expect(namespace).toEqual(pvTemplateJson.metadata.namespace);
    expect({ storage: '100Gib' }).toEqual(pvTemplateJson.spec.capacity);
    expect({ path: nfsPath, server: serverIp }).toEqual(pvTemplateJson.spec.nfs);

    expect(`pv-${name}-claim`).toEqual(pvcTemplateJson.metadata.name);
    expect(name).toEqual(pvcTemplateJson.metadata.labels.app);
    expect(name).toEqual(pvcTemplateJson.spec.storageClassName);
    expect(namespace).toEqual(pvcTemplateJson.metadata.namespace);
    expect({ requests: { storage: '100Gib' } }).toEqual(pvcTemplateJson.spec.resources);
  });
});
