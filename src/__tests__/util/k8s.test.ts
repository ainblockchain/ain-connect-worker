import * as sinon from 'sinon';
import K8sUtil from '../../util/k8s';

const k8sUtil = new K8sUtil('', true);

describe('K8sUtil', () => {
  beforeEach(() => {
    sinon.stub(k8sUtil, 'apply' as any)
      .callsFake(async (templateJson: Object) => templateJson);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('<convertUnitCpu>', () => {
    const result1 = k8sUtil.convertUnitCpu('1');
    const result2 = k8sUtil.convertUnitCpu('10000m');

    expect(1000).toEqual(result1);
    expect(10000).toEqual(result2);
  });

  it('<convertUnitMemory>', () => {
    const result1 = k8sUtil.convertUnitMemory('10Gi');
    const result2 = k8sUtil.convertUnitMemory('10G');
    const result3 = k8sUtil.convertUnitMemory('10000Ki');
    const result4 = k8sUtil.convertUnitMemory('10Mi');

    expect(10000).toEqual(result1);
    expect(10000).toEqual(result2);
    expect(10).toEqual(result3);
    expect(10).toEqual(result4);
  });

  it('<createIstioGateway>', async () => {
    const name = 'worker';
    const endpoint = 'worker.ai';
    const answer = {
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
    const result = await k8sUtil.createIstioGateway(name, endpoint);

    expect(answer).toEqual(result);
  });

  it('<createNamespace>', async () => {
    const name = 'worker';
    const answer = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
        labels: {
          ainConnect: 'yes',
        },
      },
    };

    const result = await k8sUtil.createNamespace(name);

    expect(answer).toEqual(result);
  });

  it('<createDeployment>', async () => {
    const name = 'nfs';
    const namespace = 'default';
    const labels = { test: 'yes' };
    const replicas = 1;
    const nodePoolLabel = 'ainConnect';
    const containerSpec = {
      imagePath: 'k8s.gcr.io/volume-nfs:0.8',
      ports: [2049],
      resourceLimits: {
        cpu: 1000,
        gpu: 1,
        memory: 1000,
      },
      env: {
        test: 'yes',
      },
    };
    const storageSpecs = {
      storageId: {
        mountPath: '/root',
      },
    };
    const secretSpec = {
      secretId: {
        mountPath: '/root',
      },
    };
    const imagePullSecretName = 'ttt';
    const answer = {
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
                ports: [{
                  containerPort: containerSpec.ports[0],
                }],
                volumeMounts: [{
                  name: 'storageId-ps', mountPath: '/root',
                }, {
                  name: Object.keys(secretSpec)[0],
                  mountPath: secretSpec[Object.keys(secretSpec)[0]].mountPath,
                  defaultMode: '256',
                }],
                env: [{
                  name: Object.keys(containerSpec.env)[0],
                  value: containerSpec.env[Object.keys(containerSpec.env)[0]],
                }],
                resources: {
                  requests: {
                    cpu: '1000m',
                    memory: '1000Mi',
                    'nvidia.com/gpu': '1',
                  },
                  limits: {
                    cpu: '1000m',
                    memory: '1000Mi',
                    'nvidia.com/gpu': '1',
                  },
                },
              },
            ],
            imagePullSecrets: [{
              name: imagePullSecretName,
            }],
            volumes: [{
              name: 'storageId-ps',
              persistentVolumeClaim: { claimName: 'pv-storageId-claim' },
            }, {
              name: Object.keys(secretSpec)[0],
              secret: {
                secretName: Object.keys(secretSpec)[0],
              },
            }],
          },
        },
      },
    };

    const result = await k8sUtil.createDeployment(
      name, namespace, containerSpec, storageSpecs,
      secretSpec, imagePullSecretName,
      labels, nodePoolLabel, replicas,
    );

    expect(answer).toEqual(result);
  });

  it('<createService>', async () => {
    const name = 'worker';
    const namespace = 'namespace';
    const ports = [100];
    const labels = { test: 'yes' };

    const result = await k8sUtil.createService(name, namespace, ports, labels);
    const answer = {
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
        ports: [{ name: `http${ports[0]}`, port: ports[0], targetPort: ports[0] }],
        selector: { app: name },
      },
    };
    expect(answer).toEqual(result);
  });

  it('<creteaVirtualService>', async () => {
    const name = 'worker';
    const namespace = 'namespace';
    const endpoint = 'worker.ai';
    const port = 3000;
    const gateway = 'worker.istio-system';
    const labels = { test: 'yes' };

    const result = await k8sUtil.createVirtualService(
      name, namespace, endpoint, gateway, port, labels,
    );
    const answer = {
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
    expect(answer).toEqual(result);
  });

  it('<createStorage>', async () => {
    const name = 'worker';
    const namespace = 'namespace';
    const serverIp = '10.10.10.10';
    const nfsPath = '/';
    const storageGb = 30; // 30Gb
    const labels = { test: 'yes' };

    const result = await k8sUtil.createStorage(
      name, namespace, serverIp, nfsPath, storageGb, labels,
    );
    const answerPv = {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: {
        namespace,
        name: `pv-${name}`,
        labels: { ...labels, app: name, ainConnect: 'yes' },
      },
      spec: {
        capacity: { storage: `${storageGb}Gi` },
        accessModes: ['ReadWriteMany'],
        storageClassName: name,
        nfs: { path: nfsPath, server: serverIp },
        persistentVolumeReclaimPolicy: 'Retain',
      },
    };
    const answerPvc = {
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
        resources: { requests: { storage: `${storageGb}Gi` } },
      },
    };

    expect(answerPv).toEqual(result['pvResult']);
    expect(answerPvc).toEqual(result['pvcResult']);
  });

  it('<getDockerSecretData>', () => {
    const username = 'worker';
    const password = '123123';
    const server = 'docker.io';
    const answer = {
      // eslint-disable-next-line no-useless-escape
      '.dockerconfigjson': '{\"auths\":{\"docker.io\":{\"username\":\"worker\",\"password\":\"123123\",\"auth\":\"d29ya2VyOjEyMzEyMw==\"}}}',
    };

    const result = k8sUtil.getDockerSecretData(username, password, server);

    expect(answer).toEqual(result);
  });

  it('<deleteResource: Invalid params>', async () => {
    const name = 'worker';

    const deploymentResult = await k8sUtil.deleteResource('deployment', name)
      .catch((error) => error);
    const serviceResult = await k8sUtil.deleteResource('service', name)
      .catch((error) => error);
    const virtualServiceResult = await k8sUtil.deleteResource('virtualService', name)
      .catch((error) => error);
    const storageResult = await k8sUtil.deleteResource('storage', name)
      .catch((error) => error);

    expect('Invalid Params').toEqual(deploymentResult);
    expect('Invalid Params').toEqual(serviceResult);
    expect('Invalid Params').toEqual(virtualServiceResult);
    expect('Invalid Params').toEqual(storageResult);
  });
});
