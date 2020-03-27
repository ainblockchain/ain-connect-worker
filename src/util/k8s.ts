import * as fs from 'fs';
import * as util from 'util';
import { safeLoadAll, safeDump } from 'js-yaml';

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
      const yaml = data.replace(/DOMAIN/g, `"${constants.DOMAIN}"`);
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
      log.error(`[-] failed to get pod's status - ${e}`);
      return false;
    }
  }

  static async checkRunning(containerId: string): Promise<boolean> {
    try {
      const command = `kubectl get pod $(kubectl get pod -l app=${containerId} -o jsonpath={.items..metadata.name}) --output=jsonpath={.status.phase}`;
      const data = await exec(command);
      return data.stdout === 'Running';
    } catch (e) {
      log.error(`[-] failed to get pod's status - ${e}`);
      return false;
    }
  }


  static async create(containerId: string) {
    let exist = false;
    try {
      const data = await util.promisify(fs.readFile)(`${YAML_PATH}/template.yaml`, 'utf8');
      const yaml = data.replace(/CONTAINER_ID/g, containerId).replace(/IMAGE/g, constants.IMAGE!)
        .replace(/DOMAIN/g, constants.DOMAIN.replace('*', containerId));
      const yamlJsons = safeLoadAll(yaml);
      yamlJsons[0].spec.resources.requests.storage = `${constants.STORAGE_LIMIT_Gi}Gi`;
      yamlJsons[1].spec.template.spec.containers[0].resources = {
        limits: {
          'nvidia.com/gpu': (constants.GPU_LIMIT) ? `${constants.GPU_LIMIT}` : constants.GPU_LIMIT,
          memory: `${constants.MEMORY_LIMIT_Mi}Mi`,
          cpu: `${constants.CPU_LIMIT_m}m`,
        },
        requests: {
          'nvidia.com/gpu': (constants.GPU_LIMIT) ? `${constants.GPU_LIMIT}` : constants.GPU_LIMIT,
          memory: `${constants.MEMORY_LIMIT_Mi}Mi`,
          cpu: `${constants.CPU_LIMIT_m}m`,
        },
      };
      for (const yamlJson of yamlJsons) {
        await k8s.apply(`${YAML_PATH}/${containerId}.yaml`, safeDump(JSON.parse(JSON.stringify(yamlJson))));
      }

      // check
      for (let i = 0; i < CHECK_COUNT; i += 1) {
        await delay(HEALTH_CHECK_MS);
        exist = await k8s.checkRunning(containerId);
        if (exist) break;
      }
      return exist;
    } catch (e) {
      await exec(`rm -rf ${YAML_PATH}/${containerId}.yaml`);
      log.error(`[-] failed to create pod - ${e}`);
      return false;
    }
  }

  static async delete(containerId: string) {
    await exec(`kubectl delete svc,pod,deploy,VirtualService,PersistentVolumeClaim -l app=${containerId}`);
  }
}
