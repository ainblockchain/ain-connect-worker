import { setIntervalAsync } from 'set-interval-async/dynamic';
import ClientJsonRpc from '../jsonRpc/index';
import * as constants from '../common/constants';
import encryptionHelper from '../util/encryption';
import Logger from '../common/logger';
import Container from '../manager/container';

const log = Logger.createLogger('handler.tracker');

export default class Tracker {
  private static rpcManager: ClientJsonRpc = new ClientJsonRpc(`https://${constants.SERVER_ADDR}`);

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
      log.info('[+] start to connect on Tracker');
      return true;
    } catch (error) {
      throw new Error(`<tracker> ${error}`);
    }
  }

  static async register() {
    try {
      const clusterInfo = {
        address: constants.CLUSTER_ADDR,
        clusterName: constants.CLUSTER_NAME,
        description: constants.DESCRIPTION,
        priceBySec: constants.PRICE,
      };
      const ready = await Container.getInstance().getReadyInfo();
      if (!ready) {
        throw new Error('not ready');
      }
      const clusterSpec = {
        cpu: `${constants.CPU_LIMIT_m}m`,
        gpu: constants.GPU_LIMIT || '0',
        memory: `${constants.MEMORY_LIMIT_Mi}Mi`,
        storage: `${constants.STORAGE_LIMIT_Gi}Gi`,
        image: constants.IMAGE,
      };
      const registerParams = encryptionHelper.signatureMessage(
        {
          ready: Number(ready),
          clusterKey: constants.CLUSTER_KEY,
          version: constants.VERSION,
          clusterSpec: JSON.stringify(clusterSpec),
          clusterInfo: JSON.stringify(clusterInfo),
        },
        constants.CLUSTER_ADDR, constants.SECRET_KEY,
      );
      const registerResult = await this.rpcManager.call('ain_registerCluster', registerParams);
      if (!registerResult.data.result.success) {
        throw JSON.stringify(registerResult.data);
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
    log.debug('[+] send to message for health check');
  }

  static async terminate() {
    const params = encryptionHelper.signatureMessage(
      { clusterKey: constants.CLUSTER_KEY },
      constants.CLUSTER_ADDR, constants.SECRET_KEY,
    );
    await this.rpcManager.call('ain_unregisterCluster', params);
  }
}
