import * as fs from 'fs';
import * as util from 'util';
import { safeLoadAll, safeDump } from 'js-yaml';
import axios from 'axios';
import * as constants from '../common/constants';
import Logger from '../common/logger';

const exec = util.promisify(require('child_process').exec);

const log = Logger.createLogger('util.k8s');
const HEALTH_CHECK_MS = 2000;
const CHECK_COUNT = 85;
const YAML_PATH = './kube_yaml';

const delay = async (ms: number) => {
  const result = await new Promise((resolve) => setTimeout(resolve, ms));
  return result;
};

export default class k8s {
  static async getReadyForCreate() {
    try {
      // @Todo check Resource
      return true;
    } catch (error) {
      log.error(`[-] failed to get ready for create ${error}`);
      return false;
    }
  }

  static async apply(filePath: string, yamlStr: string) {
    await util.promisify(fs.writeFile)(filePath, yamlStr);
    const command = `kubectl apply -f ${filePath}`;
    await exec(command);
    await exec(`rm -rf ${filePath}`);
  }

  static async init() {
    try {
      await exec('kubectl delete svc,gateway,pod,deploy,VirtualService,PersistentVolumeClaim,PersistentVolume --all');
      const data = await util.promisify(fs.readFile)(`${YAML_PATH}/init_template.yaml`, 'utf8');
      const yaml = data.replace(/DOMAIN/g, `"${constants.CLUSTER_DOMAIN}"`);
      const result = await exec('kubectl get services -n istio-system istio-ingressgateway -o yaml');
      const yamlJsons = safeLoadAll(result.stdout);
      const startNodePort = yamlJsons[0].spec.ports[2].nodePort;
      const openPortList = [81, 82, 8000, 84];
      for (const idx in openPortList) {
        if ({}.hasOwnProperty.call(openPortList, idx)) {
          let overlap = false;
          for (const portInfo of yamlJsons[0].spec.ports) {
            if (Number(portInfo.port) === openPortList[idx]) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            yamlJsons[0].spec.ports.push({
              name: `http${Number(idx) + 3}`,
              nodePort: startNodePort + Number(idx) + 1,
              port: openPortList[idx],
              protocol: 'TCP',
              targetPort: openPortList[idx],
            });
          }
        }
      }
      await k8s.apply(`${YAML_PATH}/istio-ingressgateway.yaml`, safeDump(yamlJsons[0]));
      await k8s.apply(`${YAML_PATH}/init.yaml`, yaml);
      let exist = false;
      for (let i = 0; i < CHECK_COUNT; i += 1) {
        await delay(HEALTH_CHECK_MS);
        exist = await k8s.checkInit();
        if (exist) break;
      }
      return exist;
    } catch (e) {
      await exec(`rm -rf ${YAML_PATH}/init.yaml`);
      log.error(`[-] failed to init - ${e}`);
      return false;
    }
  }

  static async checkInit(): Promise<boolean> {
    try {
      const data = await exec('kubectl get gateway');
      return !!data.stdout.includes('cluster-gateway');
    } catch (e) {
      log.error(`[-] failed to get Pod Status - ${e}`);
      return false;
    }
  }

  static async checkRunning(containerUrl: string): Promise<boolean> {
    try {
      const response = await axios.get(`http://${containerUrl}:8000/health`);
      return response.data === 'ok';
    } catch (e) {
      return false;
    }
  }

  static async createContainer(containerId: string, publickey: string) {
    let exist = false;
    try {
      const data = await util.promisify(fs.readFile)(`${YAML_PATH}/template.yaml`, 'utf8');
      const containerUrl = constants.CLUSTER_DOMAIN!.replace('*', containerId);
      const yaml = data.replace(/CONTAINER_ID/g, containerId).replace(/IMAGE/g, constants.CONTAINER_IMAGE!)
        .replace(/DOMAIN/g, containerUrl);
      const yamlJsons = safeLoadAll(yaml);
      const resources = {
        'nvidia.com/gpu': (constants.CONTAINER_GPU_LIMIT) ? undefined : constants.CONTAINER_GPU_LIMIT,
        memory: `${constants.CONTAINER_MEMORY_LIMIT}`,
        cpu: `${constants.CONTAINER_CPU_LIMIT}`,
      };
      yamlJsons[0].spec.resources.requests.storage = `${constants.CONTAINER_STORAGE_LIMIT}`;
      yamlJsons[1].spec.template.spec.containers[0].resources = {
        limits: resources,
        requests: resources,
      };
      for (const yamlJson of yamlJsons) {
        await k8s.apply(`${YAML_PATH}/${containerId}.yaml`, safeDump(JSON.parse(JSON.stringify(yamlJson))));
      }

      // check
      for (let i = 0; i < CHECK_COUNT; i += 1) {
        await delay(HEALTH_CHECK_MS);
        exist = await k8s.checkRunning(containerUrl);
        if (exist) break;
      }
      return exist;
    } catch (e) {
      await exec(`rm -rf ${YAML_PATH}/${containerId}.yaml`);
      log.error(`[-] failed to create pod - ${e}`);
      return false;
    }
  }

  static async deleteContainer(containerId: string) {
    await exec(`kubectl delete svc,pod,deploy,VirtualService,PersistentVolumeClaim -l app=${containerId}`);
  }
}
