import * as fs from 'fs';
import * as util from 'util';
import { safeLoadAll, safeDump } from 'js-yaml';

import * as constants from '../common/constants';
import Logger from '../common/logger';

const exec = util.promisify(require('child_process').exec);

const log = Logger.createLogger('util.k8s');
const HEALTH_CHECK_MS = 2000;
const CHECK_COUNT = 55;
const YAML_PATH = './kube_yaml';

const delay = async (ms: number) => {
  const result = await new Promise((resolve) => setTimeout(resolve, ms));
  return result;
};

export default class k8s {
  static async availableResource() {
    const resourceIndo = {};
    const topNodeResult = await exec('kubectl top node');
    const rows = topNodeResult.stdout.split('\n').splice(1).filter((e: string) => e !== '');
    rows.forEach((nodeInfo: string) => {
      const nodeInfoList = nodeInfo.split(' ').filter((e: string) => e !== '');
      const cpu = (100 - parseInt(nodeInfoList[2], 10))
        * (parseInt(nodeInfoList[1], 10) / (parseInt(nodeInfoList[2], 10)));
      const memory = (100 - parseInt(nodeInfoList[4], 10))
        * (parseInt(nodeInfoList[3], 10) / (parseInt(nodeInfoList[4], 10)));
      resourceIndo[nodeInfoList[0]] = {
        cpu,
        memory,
      };
    });

    if (constants.GPU_LIMIT) {
      const gpuResult = await exec('kubectl get nodes -o=custom-columns=NAME:.metadata.name,GPU:.status.allocatable.nvidia\\.com/gpu');
      const gpuRows = gpuResult.stdout.split('\n').splice(1).filter((e: string) => e !== '');
      gpuRows.forEach((nodeInfo: string) => {
        const nodeInfoList = nodeInfo.split(' ').filter((e: string) => e !== '');
        resourceIndo[nodeInfoList[0]].gpu = (nodeInfoList[1] !== '<none>') ? parseInt(nodeInfoList[1], 10) : 0;
      });
    }
    return resourceIndo;
  }

  static async getReadyForCreate() {
    try {
      const resourceIndo = await k8s.availableResource();
      for (const name of Object.keys(resourceIndo)) {
        if (resourceIndo[name].cpu > parseInt(constants.CPU_LIMIT!, 10)
          && resourceIndo[name].memory > parseInt(constants.MEMORY_LIMIT!, 10)
          && (!constants.GPU_LIMIT
             || resourceIndo[name].gpu >= parseInt(constants.GPU_LIMIT!, 10))) {
          return true;
        }
      }
      return false;
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
      await exec('kubectl delete svc,gateway,pod,deploy,VirtualService,PersistentVolumeClaim --all');
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
      yamlJsons[0].spec.resources.requests.storage = constants.STORAGE_LIMIT;
      yamlJsons[1].spec.template.spec.containers.resources = {
        limits: {
          'nvidia.com/gpu': constants.GPU_LIMIT,
          memory: constants.MEMORY_LIMIT,
          cpu: constants.CPU_LIMIT,
        },
      };
      // PersistentVolumeClaim
      await k8s.apply(`${YAML_PATH}/${containerId}.yaml`, safeDump(JSON.parse(JSON.stringify(yamlJsons[0]))));
      // Deployment
      await k8s.apply(`${YAML_PATH}/${containerId}.yaml`, safeDump(JSON.parse(JSON.stringify(yamlJsons[1]))));
      // Service
      await k8s.apply(`${YAML_PATH}/${containerId}.yaml`, safeDump(JSON.parse(JSON.stringify(yamlJsons[2]))));
      // VirtualService
      await k8s.apply(`${YAML_PATH}/${containerId}.yaml`, safeDump(JSON.parse(JSON.stringify(yamlJsons[3]))));

      // check
      for (let i = 0; i < CHECK_COUNT; i += 1) {
        await delay(HEALTH_CHECK_MS);
        exist = await k8s.checkRunning(containerId);
        if (exist) break;
      }
      return exist;
    } catch (e) {
      // await exec(`rm -rf ${YAML_PATH}/${containerId}.yaml`);
      log.error(`[-] failed to create pod - ${e}`);
      return false;
    }
  }

  static async delete(containerId: string) {
    await exec(`kubectl delete svc,pod,deploy,VirtualService,PersistentVolumeClaim -l app=${containerId}`);
  }
}
