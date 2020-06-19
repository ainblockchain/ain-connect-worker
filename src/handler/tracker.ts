import { setIntervalAsync } from 'set-interval-async/dynamic';
import ClientJsonRpc from '../jsonRpc/index';
import * as constants from '../common/constants';
import encryptionHelper from '../util/encryption';
import Logger from '../common/logger';
import Container from '../manager/container';
import { CustomError, STATUS_CODE, errorCategoryInfo } from '../common/error';

const log = Logger.createLogger('handler.tracker');

export default class Tracker {
  private static rpcManager: ClientJsonRpc = new ClientJsonRpc(constants.SERVER_ADDR!);

  static async start() {
    try {
      await Tracker.register();
      setIntervalAsync(
        async () => {
          try {
            await Tracker.healthCheck();
          } catch (error) {
            log.error(`[-] failed to send health message - ${error}`);
          }
        },
        constants.TRACKER_HEALTH_MS,
      );
      log.info('[+] started to connect on Tracker');
      return true;
    } catch (error) {
      throw new Error(`<tracker> ${error}`);
    }
  }

  static async register() {
    try {
      const ready = await Container.getInstance().getReadyInfo();
      if (!ready) {
        throw new CustomError(errorCategoryInfo.registerTracker, STATUS_CODE.notReady);
      }
      const clusterInfo = {
        address: constants.CLUSTER_ADDR,
        clusterName: constants.CLUSTER_NAME,
        title: constants.CLUSTER_TITLE,
        description: constants.CLUSTER_DESCRIPTION,
        priceBySec: constants.PRICE_PER_SECOND,
        gpuName: constants.CLUSTER_GPU_NAME,
      };
      const containerSpec = {
        cpu: `${constants.CONTAINER_CPU_LIMIT} vCPU`,
        gpu: constants.CONTAINER_GPU_LIMIT,
        memory: `${constants.CONTAINER_MEMORY_LIMIT}B`,
        storage: `${constants.CONTAINER_STORAGE_LIMIT}B`,
        image: constants.CONTAINER_IMAGE,
        os: constants.CONTAINER_OS,
        app: constants.CONTAINER_APP,
        library: constants.CONTAINER_LIBRARY,
      };
      const registerParams = encryptionHelper.signatureMessage(
        {
          ready: Number(ready),
          clusterKey: constants.CLUSTER_KEY,
          version: constants.VERSION,
          containerSpec: JSON.stringify(containerSpec),
          clusterInfo: JSON.stringify(clusterInfo),
        },
        constants.CLUSTER_ADDR, constants.SECRET_KEY,
      );

      const registerResult = await this.rpcManager.call('ain_registerCluster', registerParams);
      if (registerResult.data.error) {
        throw new CustomError(
          errorCategoryInfo.registerTracker,
          STATUS_CODE.callError,
          JSON.stringify(registerResult.data.error),
        );
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  static async healthCheck() {
    const healthReedy = await Container.getInstance().getReadyInfo();
    const healthParams = encryptionHelper.signatureMessage(
      { clusterKey: constants.CLUSTER_KEY, ready: Number(healthReedy) },
      constants.CLUSTER_ADDR, constants.SECRET_KEY,
    );
    await this.rpcManager.call('ain_healthCheck', healthParams);
  }

  static async terminate() {
    const params = encryptionHelper.signatureMessage(
      { clusterKey: constants.CLUSTER_KEY },
      constants.CLUSTER_ADDR, constants.SECRET_KEY,
    );
    await this.rpcManager.call('ain_unregisterCluster', params);
  }
}
