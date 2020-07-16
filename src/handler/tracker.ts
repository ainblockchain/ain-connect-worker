import { setIntervalAsync } from 'set-interval-async/dynamic';
import ClientJsonRpc from '../jsonRpc/index';
import * as constants from '../common/constants';
import encryptionHelper from '../util/encryption';
import Logger from '../common/logger';
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
      const clusterInfo = {
        address: constants.CLUSTER_ADDR,
        clusterName: constants.CLUSTER_NAME,
        title: '',
        description: '',
        priceBySec: '0',
        gpuName: '',
        isPrivate: 1,
      };
      const containerSpec = {
        cpu: '',
        gpu: '',
        memory: '',
        storage: '',
        image: '',
        os: '',
        app: '',
        library: '',
      };
      const registerParams = encryptionHelper.signatureMessage(
        {
          ready: 1,
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
    const healthParams = encryptionHelper.signatureMessage(
      { clusterKey: constants.CLUSTER_KEY, ready: 1 },
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
